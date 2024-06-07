import { SupportedP2PDeliveryNetwork } from "../db/entities";

export const THEDOMAIN_SETTINGS: {
  enabledP2PNetworks: SupportedP2PDeliveryNetwork[];
  waitForP2PBootupMs: number;
  inferencePollingIntervalMs: number;
  inferenceRequestQueueDebounceMs: number;
  embeddingsQueueDebounceMs: number;
} = {
  enabledP2PNetworks: ["nostr", "gun", "torrent", "nkn"],
  waitForP2PBootupMs: 5000,
  inferencePollingIntervalMs: 5000,
  inferenceRequestQueueDebounceMs: 1000,
  embeddingsQueueDebounceMs: 100,
};

export const QUORUM_SETTINGS: {
  // TODO: This is being sent out but not really enforced
  quorumRevealTimeoutMs: number; // Amount of time allowed between endingAt and quorum reveals being received
  quorumRevealRequestIssueTimeoutMs: number; // Amount of time allowed between endingAt and quorum reveal requests going out
  quorumConsensusWindowMs: number;
} = {
  quorumRevealRequestIssueTimeoutMs: 10000,
  quorumRevealTimeoutMs: 15000,
  quorumConsensusWindowMs: 30000,
};
