import { LLMModelName } from "../llm/types";

type InferenceSecurityFrame = {
  quorum: number; // Number of inferences that need to happen for a quorum
  maxTimeMs: number; // Max amount of time that this round can take before failed inference
  secDistance: number; // Distance in embeddingspace
  secPercentage: number; // Percentage of quorum that needs to be within secDistance embedding distance
};

type FromChainInferenceRequest = {
  requestId: string; // Either the event id or some kind of unique Id
  blockNumber: number; // Block number of the event
  prompt: string;
  model: LLMModelName;
  temperature: number;
  maxTokens: number;
};

type NetworkHyperParameterUpdate = {
  hyperParams: {
    bEmbeddingVerificationThreshold: number; // Distance between computed binary embedding and revealed binary embedding that's acceptable
    inferenceRevealTimeoutMs: number; // Time that reveal requests are valid for
  };
  hyperParamsMasterSignature: string; // Signature of the hyperParams by the master pubkey of the network
};

type PeerPacketRequiredFields = {
  peerId: string; // Public key identifying the peer
  peerTime: Date; // timezoned time of the packet from the peer
  signature: string; // Signature for this packet signed by the peerId associated Private Key
};

type PeerInfo = {
  deviceInfo: string; // Some kind of signature of what kind of device they're on;
  benchmarkResuts?: any; // To be defined, mostly about what kind of models they can run and at what TPS
};

type PeerJoined = {
  underlyingAddress: string; // ETH or other chain address they want to associate the peerId to
  signedPeerId: string; // PeerId signed by the underlying address
};

type InferenceCommit = {
  bEmbeddingHash: string;
  requestId: string;
  inferenceId: string;
};

type InferenceRevealRequest = {
  // Request to reveal inferences within this fixed quorum
  requestId: string;
  quorum: {
    peerId: string;
    bEmbeddingHash: string;
  }[];
  timeoutMs: number; // Time that this reveal request is valid to submit responses to
};

type InferenceReveal = {
  requestId: string;
  inferenceId: string;
  output: string;
  embedding: number[];
  bEmbedding: number[];
};

type InferenceRevealRejected = {
  requestId: string;
  inferenceId: string;
  rejectReason:
    | {
        type: "computed_bembedding_fails_threshold";
        computedBEmbedding: number[];
        revealedBEmbedding: number[];
      }
    | {
        type: "bembedding_hash_mismatch";
        revealedBEmbedding: number[];
        computedBEmbeddingHash: string;
        revealedBEmbeddingHash: string;
      };
};

type InferenceQuorumComputed = {
  requestId: string;
  submittedInferences: {
    inferenceId: string;
  }[];
  acceptedInferences: {
    inferenceId: string;
  }[];
  acceptedInferenceJointHash: string; // Fixed deterministic hashing of the outputs - maybe just sort the inferences alphabetically and hash the results
  acceptedSingleinference: {
    output: string;
    fromPeerId: string;
    bEmbeddingHash: string;
  };
};
