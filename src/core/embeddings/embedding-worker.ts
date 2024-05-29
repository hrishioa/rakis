import {
  cos_sim,
  DataArray,
  pipeline,
  quantize_embeddings,
} from "@xenova/transformers";
import { DeferredPromise } from "../utils/deferredpromise";
import {
  availableEmbeddingModels,
  EmbeddingModelName,
  EmbeddingWorker,
} from "./types";

const loadedEmbeddingModels: {
  [key in EmbeddingModelName]?: EmbeddingWorker;
} = {};

const embeddingQueue: DeferredPromise<DataArray[] | false>[] = [];

export async function loadEmbeddingModel(modelName: EmbeddingModelName) {
  try {
    if (!loadedEmbeddingModels[modelName]) {
      console.log("Actually loading model...", modelName);
      loadedEmbeddingModels[modelName] = {
        modelName,
        modelLoadingProgress: 0,
        modelLoadingPromise: new DeferredPromise<void>(),
      };

      loadedEmbeddingModels[modelName]!.pipeline = await pipeline(
        "feature-extraction",
        modelName,
        {
          progress_callback: (report: any) => {
            console.log(`Progress loading embedding ${modelName} - `, report);
            loadedEmbeddingModels[modelName]!.modelLoadingProgress =
              report.progress / 100;
            if (report.progress >= 100) {
              loadedEmbeddingModels[modelName]!.modelLoadingPromise.resolve();
            }
          },
        }
      );
    }
  } catch (err) {
    console.error("Error loading model - ", err);
    return false;
  }

  await loadedEmbeddingModels[modelName]!.modelLoadingPromise.promise;

  return true;
}

export async function embedText(
  texts: string[],
  modelName: EmbeddingModelName
) {
  if (!loadedEmbeddingModels[modelName]) {
    console.log("Loading model...");
    await loadEmbeddingModel(modelName);
  }

  if (!loadedEmbeddingModels[modelName]!.pipeline) {
    await loadedEmbeddingModels[modelName]!.modelLoadingPromise.promise;
    if (
      !loadedEmbeddingModels[modelName] ||
      loadedEmbeddingModels[modelName].modelLoadingProgress < 1
    ) {
      console.log(
        "Embedding model ",
        modelName,
        "could not be loaded. Exiting."
      );
      return false;
    }
  }

  const embeddings = await loadedEmbeddingModels[modelName]!.pipeline!(texts, {
    normalize: true,
    pooling: "mean",
  });

  const binaryEmbeddings = quantize_embeddings(embeddings, "binary");

  const results = texts.map((text, index) => ({
    text,
    embedding: Array.from(embeddings[index].data) as number[],
    binaryEmbedding: Array.from(binaryEmbeddings[index].data) as number[],
  }));

  console.log("Embeddings: ", results);

  return results;
}
