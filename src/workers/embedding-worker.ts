import { FeatureExtractionPipeline, pipeline } from "@xenova/transformers";
import { DeferredPromise } from "../core/utils/deferredpromise";

const availableEmbeddingModels = [
  "bert-base-multilingual-cased",
  "Xenova/all-MiniLM-L6-v2",
] as const;

const loadedEmbeddingModels: {
  [key in (typeof availableEmbeddingModels)[number]]?: {
    pipeline?: FeatureExtractionPipeline;
    state: "loading" | "ready";
    loadingPromise: DeferredPromise<void>;
  };
} = {};

export async function loadEmbeddingModel(
  modelName: (typeof availableEmbeddingModels)[number]
) {
  try {
    if (!loadedEmbeddingModels[modelName]) {
      console.log("Actually loading model...", modelName);
      loadedEmbeddingModels[modelName] = {
        state: "loading",
        loadingPromise: new DeferredPromise<void>(),
      };

      loadedEmbeddingModels[modelName]!.pipeline = await pipeline(
        "embeddings",
        modelName,
        {
          progress_callback: (report: any) => {
            console.log(`Progress loading ${modelName} - `, report);
            if (report.progress >= 100) {
              loadedEmbeddingModels[modelName]!.state = "ready";
              loadedEmbeddingModels[modelName]!.loadingPromise.resolve();
            }
          },
        }
      );
    }
  } catch (err) {
    console.error("Error loading model - ", err);
    return false;
  }

  await loadedEmbeddingModels[modelName]!.loadingPromise.promise;

  return true;
}

export async function embedText(
  text: string,
  model: (typeof availableEmbeddingModels)[number]
) {
  if (!loadedEmbeddingModels[model]) {
    console.log("Loading model...");
    await loadEmbeddingModel(model);
  }

  if (!loadedEmbeddingModels[model]!.pipeline) {
    await loadedEmbeddingModels[model]!.loadingPromise.promise;
    return false;
  }

  console.log("Embedding ", text);
  return (await loadedEmbeddingModels[model]!.pipeline!(text)).data;
}
