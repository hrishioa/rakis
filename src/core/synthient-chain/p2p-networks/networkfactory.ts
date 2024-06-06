import { SupportedP2PDeliveryNetwork } from "../db/entities";
import { ClientInfo } from "../identity";
import { timeoutPromise } from "../utils/utils";
import { NknP2PNetworkInstance } from "./nkn";
import { P2P_CONFIG } from "./p2p-config";
import { P2PNetworkInstance } from "./p2pnetwork-types";
import { GunP2PNetworkInstance } from "./pewpewdb";
import { TrysteroP2PNetworkInstance } from "./trystero";

export class P2PNetworkFactory {
  static createP2PNetworkInstance(
    network: SupportedP2PDeliveryNetwork,
    synthientId: string
  ): P2PNetworkInstance<any, any> {
    switch (network) {
      case "gun":
        return new GunP2PNetworkInstance(synthientId, {
          gunPeers: P2P_CONFIG.PEWPEW.bootstrapPeers,
          gunTopic: P2P_CONFIG.PEWPEW.topic,
          startupDelayMs: P2P_CONFIG.PEWPEW.bootFixedDelayMs,
        });
      case "nkn":
        return new NknP2PNetworkInstance(synthientId, {
          nknTopic: P2P_CONFIG.NKN.topic,
          nknWalletPassword: "password",
        });
      case "nostr":
        return new TrysteroP2PNetworkInstance(synthientId, {
          relayRedundancy: P2P_CONFIG.TRYSTERO.relayRedundancy,
          rtcConfig: P2P_CONFIG.TRYSTERO.rtcConfig,
          trysteroTopic: P2P_CONFIG.TRYSTERO.topic,
          trysteroAppId: P2P_CONFIG.TRYSTERO.appId,
          trysteroType: "nostr",
        });
      case "torrent":
        return new TrysteroP2PNetworkInstance(synthientId, {
          relayRedundancy: P2P_CONFIG.TRYSTERO.relayRedundancy,
          rtcConfig: P2P_CONFIG.TRYSTERO.rtcConfig,
          trysteroTopic: P2P_CONFIG.TRYSTERO.topic,
          trysteroAppId: P2P_CONFIG.TRYSTERO.appId,
          trysteroType: "torrent",
        });
      default:
        throw new Error(`Unsupported P2P network: ${network}`);
    }
  }

  static async initializeP2PNetworks(
    p2pNetworkInstances: P2PNetworkInstance<any, any>[],
    timeoutMs: number
  ): Promise<P2PNetworkInstance<any, any>[]> {
    const p2pLoadingResults: boolean[] = p2pNetworkInstances.map((p) => false);

    const waitingResult = await Promise.race([
      timeoutPromise(timeoutMs),
      Promise.all(
        p2pNetworkInstances.map((p, index) =>
          p.waitForReady().then(() => (p2pLoadingResults[index] = true))
        )
      ),
    ]);

    if (waitingResult === "timeout") {
      console.log("Timed out waiting for all networks to load.");
      const unloadedNetworks = p2pNetworkInstances.filter(
        (_, index) => !p2pLoadingResults[index]
      );

      if (unloadedNetworks.length >= p2pNetworkInstances.length) {
        throw new Error(
          "No p2p networks could be loaded in time. Please check logs for errors."
        );
      }
    }

    return p2pNetworkInstances.filter((_, index) => p2pLoadingResults[index]);
  }
}
