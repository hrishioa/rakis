import type { EmbeddingModelName } from "../embeddings/types";
import type {
  InferenceRequest,
  InferenceSuccessResult,
  InferenceEmbedding,
  InferenceRevealRequest,
  InferenceReveal,
  P2PInferenceRequestPacket,
  ReceivedPeerPacket,
  InferenceCommit,
  InferenceRevealRejected,
  InferenceQuorumComputed,
  PeerPacket,
  PeerHeart,
} from "./packet-types";

// TODO: Move this elsewhere
export const P2PDeliveryNetworks = [
  "nostr",
  "waku",
  "gun",
  "torrent",
  "nkn",
] as const;

export type SupportedP2PDeliveryNetwork = (typeof P2PDeliveryNetworks)[number];

export type SupportedChains = "eth" | "arbitrum" | "ecumene";
// | "solana"; // Coming soon?

export type ChainIdentity = {
  chain: SupportedChains;
  address: string;
  // Signature of the synthientId from this node with the chain address
  synthientIdSignature: string;
  signedWithWallet: "metamask"; // TODO: Change to a proper enum later, like metamask, phantom, etc
};

export type Peer = {
  synthientId: string; // Public key on the synthient network
  seenOn: SupportedP2PDeliveryNetwork[];
  lastSeen: Date;
  chainIds: ChainIdentity[];
  deviceInfo?: string;
};

// Inference DB

export type InferenceDBEvents = {
  inferenceResultAwaitingEmbedding: (
    request: InferenceRequest,
    result: InferenceSuccessResult
  ) => void;
  newInferenceEmbedding: (embedding: InferenceEmbedding) => void;
  newActiveInferenceRequest: (request: InferenceRequest) => void;
  newInferenceRequest: (request: InferenceRequest) => void;
  requestQuorumReveal: (revealRequests: InferenceRevealRequest[]) => void;
  revealedInference: (revealPacket: InferenceReveal) => void;
};

// Packet DB

export type PacketDBEvents = {
  newP2PInferenceRequest: (packet: P2PInferenceRequestPacket) => void;
  newInferenceCommit: (
    packet: Omit<ReceivedPeerPacket, "packet"> & { packet: InferenceCommit }
  ) => void;
  newInferenceRevealRequest: (
    packet: Omit<ReceivedPeerPacket, "packet"> & {
      packet: InferenceRevealRequest;
    }
  ) => void;
  newInferenceRevealed: (
    packet: Omit<ReceivedPeerPacket, "packet"> & {
      packet: InferenceReveal;
    }
  ) => void;
  peerHeart: (packet: ReceivedPeerPacket & { packet: PeerHeart }) => void;
};

// Quorum DB

export type InferenceQuorum = {
  requestId: string;
  status:
    | "awaiting_commitments"
    | "awaiting_reveal"
    | "failed"
    | "completed"
    | "awaiting_consensus" // means getting the embeddings and other processing ready
    | "verifying_consensus";
  quorumThreshold: number;
  endingAt: Date; // Stringified date
  quorumCommitted: number; // Number of peers that have committed a hash
  quorumRevealed: number; // Number of peers that have revealed their embedding
  consensusRequestedAt?: Date; // Time that the consensus was requested
  embeddingModel: EmbeddingModelName;
  quorum: {
    inferenceId: string;
    synthientId: string;
    bEmbeddingHash: string;
    commitReceivedAt: Date;
    reveal?: {
      embedding: number[];
      bEmbedding: number[];
      output: string;
      receivedAt: Date;
    };
  }[];
};

export type ConsensusResults = {
  requestId: string;
  success: boolean;
  reason: string;
  debug: {
    distances?: number[][];
    clusterSizeNeeded?: number;
  };
  rejectionPackets: InferenceRevealRejected[];
  computedQuorumPacket?: InferenceQuorumComputed;
};

export type QuorumDBEvents = {
  requestReveal: (quorums: InferenceQuorum[]) => void;
  newQuorumAwaitingConsensus: (
    requestId: string,
    modelName: EmbeddingModelName,
    consensusRequestedAt: Date,
    hasMyContribution: boolean
  ) => void;
  consensusPackets: (packts: PeerPacket[]) => void;
};
