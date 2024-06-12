import { DEFAULT_P2P_SETTINGS } from "../thedomain/settings";

export function getP2PConfig(p2pSettings: typeof DEFAULT_P2P_SETTINGS) {
  const config = DEFAULT_P2P_CONFIG;

  config.PEWPEW.topic = p2pSettings.topic;
  config.NKN.topic = p2pSettings.topic;
  config.TRYSTERO.appId = p2pSettings.topic;
  config.TRYSTERO.topic = p2pSettings.topic + "T";

  config.NKN.maxSendErrorsBeforeRestart =
    p2pSettings.maxTransmissionErrorsBeforeRestart;
  config.TRYSTERO.maxTransmissionErrorsBeforeRestart =
    p2pSettings.maxTransmissionErrorsBeforeRestart;

  return config;
}

export const DEFAULT_P2P_CONFIG = {
  PEWPEW: {
    topic: "rakis0",
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
    topic: "rakis0",
  },
  TRYSTERO: {
    maxTransmissionErrorsBeforeRestart: 5,
    appId: "rakis",
    topic: "rakis0",
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
