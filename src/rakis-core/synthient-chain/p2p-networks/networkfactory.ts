import { SupportedP2PDeliveryNetwork } from "../db/entities";
import { loadSettings } from "../thedomain/settings";
import { timeoutPromise } from "../utils/utils";
import { NknP2PNetworkInstance } from "./nkn";
import { P2PNetworkInstance } from "./p2pnetwork-types";
import { GunP2PNetworkInstance } from "./pewpewdb";
import { TrysteroP2PNetworkInstance } from "./trystero";
import { createLogger, logStyles } from "../utils/logger";
import { getP2PConfig } from "./p2p-config";

const logger = createLogger("Domain", logStyles.theDomain);

const p2pConfig = getP2PConfig(loadSettings().p2pSettings);

export class P2PNetworkFactory {
  static createP2PNetworkInstance(
    network: SupportedP2PDeliveryNetwork,
    synthientId: string
  ): P2PNetworkInstance<any, any> {
    switch (network) {
      case "gun":
        return new GunP2PNetworkInstance(synthientId, {
          gunPeers: p2pConfig.PEWPEW.bootstrapPeers,
          gunTopic: p2pConfig.PEWPEW.topic,
          startupDelayMs: p2pConfig.PEWPEW.bootFixedDelayMs,
        });
      case "nkn":
        return new NknP2PNetworkInstance(
          synthientId,
          {
            nknTopic: p2pConfig.NKN.topic,
            nknWalletPassword: "password",
          },
          p2pConfig.NKN
        );
      case "nostr":
        return new TrysteroP2PNetworkInstance(
          synthientId,
          {
            relayRedundancy: p2pConfig.TRYSTERO.relayRedundancy,
            rtcConfig: p2pConfig.TRYSTERO.rtcConfig,
            trysteroTopic: p2pConfig.TRYSTERO.topic,
            trysteroAppId: p2pConfig.TRYSTERO.appId,
            trysteroType: "nostr",
          },
          p2pConfig.TRYSTERO
        );
      case "torrent":
        return new TrysteroP2PNetworkInstance(
          synthientId,
          {
            relayRedundancy: p2pConfig.TRYSTERO.relayRedundancy,
            rtcConfig: p2pConfig.TRYSTERO.rtcConfig,
            trysteroTopic: p2pConfig.TRYSTERO.topic,
            trysteroAppId: p2pConfig.TRYSTERO.appId,
            trysteroType: "torrent",
          },
          p2pConfig.TRYSTERO
        );
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
      logger.debug("Timed out waiting for all networks to load.");
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
