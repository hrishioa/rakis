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
