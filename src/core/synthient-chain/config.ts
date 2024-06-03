// Starting place for network hyperparameters

export const SYNTHIENT_NETWORK_CONFIG = {};

export const IDENTITY_ENCRYPTED_KEY = "encSynthientId";

export const GUNDB_CONFIG = {
  topic: "synthient-testnet5",
  bootFixedDelayMs: 1000,
  bootstrapPeers: [
    "https://gun-manhattan.herokuapp.com/gun",
    "https://peer.wallie.io/gun",
    // "https://gundb-relay-mlccl.ondigitalocean.app/gun",
    "https://plankton-app-6qfp3.ondigitalocean.app/",
  ],
};

export const NKN_CONFIG = {
  maxSendErrorsBeforeRestart: 5,
  topic: "zensu5",
};
