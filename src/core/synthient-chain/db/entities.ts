// TODO: Move this elsewhere
export type SupportedP2PDeliveryNetwork =
  | "nostr"
  | "waku"
  | "gundb"
  | "torrent"
  | "nkn";

export type ChainIdentity = {
  chain: "eth" | "arbitrum" | "solana";
  address: string;
  // Signature of the synthientId from this node with the chain address
  synthientIdSignature: string;
  signedWithWallet: string; // TODO: Change to a proper enum later
};

export type Peer = {
  synthientId: string; // Public key on the synthient network
  seenOn: SupportedP2PDeliveryNetwork[];
  lastSeen: Date;
  chainIds: ChainIdentity[];
  deviceInfo: string;
};
