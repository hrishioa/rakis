import { EmbeddingModelName } from "../../embeddings/types";
import { LLMModelName } from "../../llm/types";
import {
  ChainIdentity,
  SupportedChains,
  SupportedP2PDeliveryNetwork,
} from "./entities";

// Things from chain to client

export type InferenceRequest = Required<UnprocessedInferenceRequest>;

export type UnprocessedInferenceRequest = {
  requestId?: string; // Could just be a hash of known-to-be-unique values
  payload: InferenceRequestPayload;
  endingAt?: Date; // Computed from the securityframe
  fetchedAt: Date;
};

type InferenceRequestPayload = {
  fromChain: SupportedChains;
  blockNumber: number;
  createdAt: Date;
  prompt: string;
  acceptedModels: LLMModelName[];
  temperature: number;
  maxTokens: number;
  securityFrame: InferenceSecurityFrame;
};

type InferenceSecurityFrame = {
  quorum: number; // Number of inferences that need to happen for a quorum
  maxTimeMs: number; // Max amount of time that this round can take before failed inference
  secDistance: number; // Distance in embeddingspace
  secPercentage: number; // Percentage of quorum that needs to be within secDistance embedding distance
};

// Unused for now, to set consensus thresholds and update those on the fly

type NetworkHyperParameterUpdate = {
  hyperParams: {
    bEmbeddingVerificationThreshold: number; // Distance between computed binary embedding and revealed binary embedding that's acceptable
    inferenceRevealTimeoutMs: number; // Time that reveal requests are valid for
  };
  hyperParamsMasterSignature: string; // Signature of the hyperParams by the master pubkey of the network
};

// P2P Packets

export type ReceivedPeerPacket = TransmittedPeerPacket & {
  receivedTime?: Date; // Time that the packet was received, undefined if this was our own packet
  deliveredThrough?: SupportedP2PDeliveryNetwork; // The network that this packet was delivered through
};

export type TransmittedPeerPacket = {
  synthientId: string; // Public key identifying the peer
  signature: string; // Signature for this packet signed by the synthientId associated Private Key
  packet: PeerPacket;
};

export type PeerPacket = (
  | PeerStatusUpdate
  | PeerHeart
  | PeerInfo
  | PeerConnectedChain
  | InferenceCommit
  | InferenceRevealRequest
  | InferenceReveal
  | InferenceRevealRejected
  | InferenceQuorumComputed
) & {
  createdAt: string; // Local time the packet was created at with the timezone
};

type PeerStatusUpdate = (
  | {
      status: "idle";
    }
  | {
      status: "inferencing";
      modelName: LLMModelName;
      workerId: string;
    }
  | {
      status: "completed_inference";
      tps: number;
      modelName: LLMModelName;
      workerId: string;
    }
  | {
      status: "computing_bEmbeddingHash";
      embeddingModelName: EmbeddingModelName;
    }
  | {
      status: "verifying quorum";
      requestId: string;
    }
) & {
  type: "peerStatusUpdate";
};

type PeerHeart = {
  type: "peerHeart";
  windowX: number; // X coordinate of the window
  windowY: number;
};

type PeerInfo = {
  type: "peerInfo";
  deviceInfo: string; // Some kind of signature of what kind of device they're on;
  // benchmarkResuts?: any; // To be defined, mostly about what kind of models they can run and at what TPS
};

type PeerConnectedChain = {
  type: "peerConnectedChain";
  identities: ChainIdentity[];
};

export const RequestIdPacketTypes = [
  "inferenceCommit",
  "inferenceRevealRequest",
  "inferenceReveal",
  "inferenceRevealRejected",
  "inferenceQuorumComputed",
] as const;

type InferenceCommit = {
  type: "inferenceCommit";
  bEmbeddingHash: string;
  requestId: string;
  inferenceId: string;
};

type InferenceRevealRequest = {
  type: "inferenceRevealRequest";
  // Request to reveal inferences within this fixed quorum
  requestId: string;
  quorum: {
    synthientId: string;
    bEmbeddingHash: string;
  }[];
  timeoutMs: number; // Time that this reveal request is valid to submit responses to
};

type InferenceReveal = {
  type: "inferenceReveal";
  requestId: string;
  inferenceId: string;
  output: string;
  embedding: number[];
  bEmbedding: number[];
};

type InferenceRevealRejected = {
  type: "inferenceRevealRejected";
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
  type: "inferenceQuorumComputed";
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
    fromsynthientId: string;
    bEmbeddingHash: string;
  };
};
