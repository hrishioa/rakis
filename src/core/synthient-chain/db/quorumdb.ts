export type InferenceCommittedQuorum = {
  requestId: string;
  inferenceId: string;
  quorumThreshold: number;
  endingAt: string; // Stringified date
  thresholdMet: boolean;
  quorum: {
    synthientId: string;
    bEmbeddingHash: string;
    receivedAt: string; // Stringified date
  }[];
};
