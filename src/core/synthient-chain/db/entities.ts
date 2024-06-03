// TODO: Move this elsewhere
export type SupportedP2PDeliveryNetwork =
  | "nostr"
  | "waku"
  | "gundb"
  | "torrent"
  | "nkn";

export type SupportedChains = "eth" | "arbitrum";
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
  deviceInfo: string;
};