import { pipeline, quantize_embeddings } from "@xenova/transformers";
import {
  EmbeddingModelName,
  EmbeddingWorker,
  EmbeddingWorkerReceivedMessage,
  EmbeddingWorkerSentMessage,
} from "./types";
import { DeferredPromise } from "../utils/deferredpromise";
import { EmbeddingResult } from "./types";
import { hashBinaryEmbedding } from "../utils/simple-crypto";
import { createLogger, logStyles } from "../utils/logger";
const logger = createLogger(
  "Embedding Worker",
  logStyles.embeddingEngine.worker,
  true
);

let workerInstance: EmbeddingWorker | null = null;

function sendMessageToParent(message: EmbeddingWorkerSentMessage) {
  self.postMessage(message);
}

async function loadEmbeddingWorker(
  modelName: EmbeddingModelName,
  workerId: string
) {
  try {
    if (!workerInstance) {
      workerInstance = {
        workerId,
        modelName,
        busyEmbedding: false,
        modelLoadingProgress: 0,
        modelLoadingPromise: new DeferredPromise<void>(),
      };

      workerInstance!.pipeline = await pipeline(
        "feature-extraction",
        modelName,
        {
          quantized: false,
          progress_callback: (report: any) => {
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
    return (err as Error).message;
  }

  await workerInstance!.modelLoadingPromise.promise;

  return true;
}

async function embedText(
  texts: string[],
  batchId: string
): Promise<
  | {
      success: false;
      reason: string;
    }
  | {
      success: true;
      results: EmbeddingResult[];
    }
> {
  if (!workerInstance || !workerInstance.pipeline) {
    return {
      success: false,
      reason: "Model could not be loaded.",
    };
  }

  if (workerInstance.busyEmbedding) {
    return {
      success: false,
      reason: "Worker is busy embedding.",
    };
  }

  workerInstance.busyEmbedding = true;
  sendMessageToParent({
    type: "workerBusyEmbedding",
    batchId,
  });

  try {
    logger.debug(
      `Worker ${workerInstance.workerId} is embedding ${batchId}: `,
      JSON.stringify(texts)
    );
    const embeddings = await workerInstance!.pipeline!(texts, {
      normalize: true,
      pooling: "mean",
    });

    workerInstance.busyEmbedding = false;
    sendMessageToParent({
      type: "workerIdle",
    });

    const binaryEmbeddings = quantize_embeddings(embeddings, "ubinary");

    const results: EmbeddingResult[] = await Promise.all(
      texts.map(async (text, index) => {
        return {
          text,
          embedding: embeddings.slice([index, index + 1]).data as number[],
          binaryEmbedding: binaryEmbeddings.slice([index, index + 1])
            .data as number[],
          bEmbeddingHash: await hashBinaryEmbedding(
            binaryEmbeddings.slice([index, index + 1]).data as number[]
          ),
        };
      })
    );

    return {
      success: true,
      results,
    };
  } catch (err) {
    workerInstance.busyEmbedding = false;
    sendMessageToParent({
      type: "workerIdle",
    });
    return {
      success: false,
      reason: (err as Error).message,
    };
  }
}

self.onmessage = async (
  event: MessageEvent<EmbeddingWorkerReceivedMessage>
) => {
  const message = event.data;

  switch (message.type) {
    case "loadWorker":
      const result = await loadEmbeddingWorker(
        message.modelName,
        message.workerId
      );
      if (result === true) {
        sendMessageToParent({
          type: "workerLoaded",
          modelName: message.modelName,
        });
      } else {
        sendMessageToParent({
          type: "workerLoadFailure",
          modelName: message.modelName,
          err: result,
        });
      }
      break;
    case "embedText":
      const outcome = await embedText(message.texts, message.batchId);
      if (outcome.success) {
        sendMessageToParent({
          type: "embeddingSuccess",
          batchId: message.batchId,
          results: outcome.results,
        });
      } else {
        sendMessageToParent({
          type: "embeddingFailure",
          batchId: message.batchId,
          reason: outcome.reason,
        });
      }
      break;
    default:
      logger.error("EMBEDDING WORKER GOT ", event, " - THIS SHOULDNT HAPPEN!");
      break;
  }
};
