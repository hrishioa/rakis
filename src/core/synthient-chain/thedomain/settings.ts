import { SupportedP2PDeliveryNetwork } from "../db/entities";

export const THEDOMAIN_SETTINGS: {
  enabledP2PNetworks: SupportedP2PDeliveryNetwork[];
  waitForP2PBootupMs: number;
  inferencePollingIntervalMs: number;
} = {
  enabledP2PNetworks: ["nostr", "gun", "torrent", "nkn"],
  waitForP2PBootupMs: 5000,
  inferencePollingIntervalMs: 5000,
};
