export const P2P_CONFIG = {
  PEWPEW: {
    topic: "synthient-testnet5",
    bootFixedDelayMs: 1000,
    bootstrapPeers: [
      "https://gun-manhattan.herokuapp.com/gun",
      "https://peer.wallie.io/gun",
      // "https://gundb-relay-mlccl.ondigitalocean.app/gun",
      "https://plankton-app-6qfp3.ondigitalocean.app/",
    ],
  },

  NKN: {
    maxSendErrorsBeforeRestart: 5,
    topic: "zensu5",
  },
  TRYSTERO: {
    maxTransmissionErrorsBeforeRestart: 5,
    appId: "synthient",
    topic: "synthient5",
    relayRedundancy: 4,
    rtcConfig: {
      iceServers: [
        {
          urls: "stun:stun.relay.metered.ca:80",
        },
        {
          urls: "turn:a.relay.metered.ca:80",
          username: "fd396a3275680a085c4d66cd",
          credential: "hFQmauZyx0Mv0bCK",
        },
        {
          urls: "turn:a.relay.metered.ca:80?transport=tcp",
          username: "fd396a3275680a085c4d66cd",
          credential: "hFQmauZyx0Mv0bCK",
        },
        {
          urls: "turn:a.relay.metered.ca:443",
          username: "fd396a3275680a085c4d66cd",
          credential: "hFQmauZyx0Mv0bCK",
        },
        {
          urls: "turn:a.relay.metered.ca:443?transport=tcp",
          username: "fd396a3275680a085c4d66cd",
          credential: "hFQmauZyx0Mv0bCK",
        },
      ],
    },
  },
};
