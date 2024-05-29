import type { FeatureExtractionPipeline } from "@xenova/transformers";
import type { DeferredPromise } from "../utils/deferredpromise";

export const availableEmbeddingModels = [
  "nomic-ai/nomic-embed-text-v1.5",
] as const;

export type EmbeddingModelName = (typeof availableEmbeddingModels)[number];

export type EmbeddingWorker = {
  modelName: EmbeddingModelName;
  pipeline?: FeatureExtractionPipeline;
  modelLoadingProgress: number;
  modelLoadingPromise: DeferredPromise<void>;
  busyEmbedding: boolean;
  busyEmbeddingPromise?: DeferredPromise<void>;
};

export type EmbeddingResult = {
  text: string;
  embedding: number[];
  binaryEmbedding: number[];
  bEmbeddingHash: string;
};

export type EmbeddingWorkerLogEntryRaw =
  | {
      type: "embeddings_worker_loading" | "embeddings_worker_loaded";
      modelName: EmbeddingModelName;
    }
  | {
      type: "embeddings_worker_unload";
    }
  | {
      type: "engine_loading_error";
      modelName: EmbeddingModelName;
      error: any;
    }
  | {
      type: "engine_embedding_start";
      text: string;
      batchId: string;
    }
  | {
      type: "engine_embedding_error";
      error: any;
      batchId: string;
    }
  | {
      type: "engine_embedding_success";
      bEmbeddingHash: string;
      batchId: string;
    };

export type EmbeddingWorkerLogEntry = {
  workerId: string;
} & EmbeddingWorkerLogEntryRaw;

export type EmbeddingEngineLogEntry = {
  at?: Date;
} & EmbeddingWorkerLogEntry;
