import { DataArray, pipeline, quantize_embeddings } from "@xenova/transformers";
import { DeferredPromise } from "../utils/deferredpromise";
import { EmbeddingModelName, EmbeddingResult, EmbeddingWorker } from "./types";

let workerInstance: EmbeddingWorker | null = null;

export function getWorkerStatus() {
  if (!workerInstance) {
    return {
      modelLoaded: false,
      busyEmbedding: false,
    };
  }

  return {
    modelLoadingProgress: workerInstance.modelLoadingProgress,
    modelLoaded: workerInstance.modelLoadingProgress >= 1,
    busyEmbedding: workerInstance.busyEmbedding,
  };
}

export async function waitForCompletion() {
  if (workerInstance && workerInstance.busyEmbeddingPromise) {
    console.log("Waiting for completion");
    await workerInstance.busyEmbeddingPromise.promise;
    console.log("Embedding promise completed");
  }
}

export async function loadEmbeddingWorker(modelName: EmbeddingModelName) {
  try {
    if (!workerInstance) {
      workerInstance = {
        modelName,
        busyEmbedding: false,
        modelLoadingProgress: 0,
        modelLoadingPromise: new DeferredPromise<void>(),
      };

      workerInstance!.pipeline = await pipeline(
        "feature-extraction",
        modelName,
        {
          progress_callback: (report: any) => {
            // console.log(`Progress loading embedding ${modelName} - `, report);
            if (workerInstance) {
              if (!isNaN(report.progress))
                workerInstance.modelLoadingProgress = report.progress / 100;
              if (report.progress >= 100) {
                workerInstance.modelLoadingPromise.resolve();
              }
            }
          },
        }
      );
    }
  } catch (err) {
    console.error("Error loading model - ", err);
    return false;
  }

  await workerInstance!.modelLoadingPromise.promise;

  return true;
}

export async function embedText(
  texts: string[],
  modelName: EmbeddingModelName
): Promise<false | EmbeddingResult[]> {
  if (!workerInstance || !workerInstance.pipeline) {
    console.error("Model could not be loaded.");
    return false;
  }

  if (workerInstance.busyEmbedding) {
    console.error("Worker is busy embedding.");
    return false;
  }

  if (!workerInstance!.pipeline) {
    await workerInstance!.modelLoadingPromise.promise;
    if (!workerInstance || workerInstance.modelLoadingProgress < 1) {
      console.log(
        "Embedding model ",
        modelName,
        "could not be loaded. Exiting."
      );
      return false;
    }
  }

  workerInstance.busyEmbedding = true;
  workerInstance.busyEmbeddingPromise = new DeferredPromise<void>();

  console.log("Actually embedding ", texts);
  const embeddings = await workerInstance!.pipeline!(texts, {
    normalize: true,
    pooling: "mean",
  });
  console.log("Actually embedded ", texts);
  workerInstance.busyEmbedding = false;
  workerInstance.busyEmbeddingPromise.resolve();

  const binaryEmbeddings = quantize_embeddings(embeddings, "binary");

  const results = texts.map((text, index) => ({
    text,
    embedding: Array.from(embeddings.data[index]) as number[],
    binaryEmbedding: Array.from(binaryEmbeddings.data[index]) as number[],
  }));

  return results;
}
