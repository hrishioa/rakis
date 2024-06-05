import { EmbeddingEngine } from "../../embeddings/embedding-engine";
import { LLMEngine } from "../../llm/llm-engine";
import { LLMModelName } from "../../llm/types";
import { GUNDB_CONFIG, NKN_CONFIG, TRYSTERO_CONFIG } from "../config";
import {
  P2PDeliveryNetworks,
  SupportedP2PDeliveryNetwork,
} from "../db/entities";
import { InferenceDB } from "../db/inferencedb";
import { TransmittedPeerPacket } from "../db/packet-types";
import { PacketDB } from "../db/packetdb";
import { PeerDB } from "../db/peerdb";
import { ClientInfo, initClientInfo } from "../identity";
import { NknP2PNetworkInstance } from "../p2p-networks/nkn";
import { P2PNetworkInstance } from "../p2p-networks/p2pnetwork-types";
import { GunP2PNetworkInstance } from "../p2p-networks/pewpewdb";
import { TrysteroP2PNetworkInstance } from "../p2p-networks/trystero";
import { generateRandomString, timeoutPromise } from "../utils/utils";
import { THEDOMAIN_SETTINGS } from "./settings";

export type DomainStartOptions = {
  identityPassword: string;
  overwriteIdentity?: boolean;
};

export class TheDomain {
  private static instance: TheDomain;

  private packetDB: PacketDB;
  private peerDB: PeerDB;
  private shutdownListeners: (() => void)[] = [];
  private embeddingEngine: EmbeddingEngine;
  private llmEngine: LLMEngine;
  private inferenceDB: InferenceDB;

  private constructor(
    private clientInfo: ClientInfo,
    private p2pNetworkInstances: P2PNetworkInstance<any, any>[]
  ) {
    this.packetDB = new PacketDB(clientInfo, this.broadcastPacket);
    this.peerDB = new PeerDB();
    this.inferenceDB = new InferenceDB();

    console.log("Databases created.");
    this.connectP2PToPacketDB();
    this.connectPacketDBToPeerDB();

    this.embeddingEngine = new EmbeddingEngine();
    this.llmEngine = new LLMEngine();

    if (typeof window !== "undefined") {
      (window as any).theDomain = {
        logInference: (
          prompt: string,
          model: LLMModelName,
          maxTimeMs: number
        ) => {
          this.inferenceDB.saveInferenceRequest({
            payload: {
              fromChain: "eth",
              blockNumber: 0,
              createdAt: new Date(),
              prompt,
              acceptedModels: [model],
              temperature: 1,
              maxTokens: 2048,
              securityFrame: {
                quorum: 10,
                maxTimeMs,
                secDistance: 0.9,
                secPercentage: 0.5,
              },
            },
            fetchedAt: new Date(),
          });
        },
        updateLLMWorkers: (modelName: LLMModelName, count: number) => {
          this.updateLLMWorkers(modelName, count);
        },
        llmWorkers: this.llmEngine.llmWorkers,
      };

      console.log("Inference request function exposed.");
    }
  }

  // TODOs:
  // 1. Register error handlers for the p2p networks, and restart them (some finite number of times) if they error out
  // 2. Expose a packet subscriber to the outside in case someone wants to listen in

  async updateLLMWorkers(
    modelName: LLMModelName,
    count: number,
    abruptKill: boolean = false
  ) {
    const numberOfExistingWorkers = Object.values(
      this.llmEngine.llmWorkers
    ).filter((worker) => worker.modelName === modelName).length;

    if (numberOfExistingWorkers === count) return;

    if (numberOfExistingWorkers < count) {
      console.log(
        "Scaling up number of llm workers for ",
        modelName,
        " to ",
        count
      );
      const scaleUpPromises: Promise<any>[] = [];
      for (let i = 0; i < count - numberOfExistingWorkers; i++) {
        const workerId = `llm-${modelName}-${generateRandomString()}`;
        scaleUpPromises.push(this.llmEngine.loadWorker(modelName, workerId));
      }

      const results = await Promise.all(scaleUpPromises);
      return results;
    } else {
      console.log(
        "Scaling down number of llm workers for ",
        modelName,
        " to ",
        count
      );

      const workerIdsByLoad = Object.keys(this.llmEngine.llmWorkers).sort(
        (a, b) =>
          this.llmEngine.llmWorkers[a].inferenceInProgress ===
          this.llmEngine.llmWorkers[b].inferenceInProgress
            ? 0
            : this.llmEngine.llmWorkers[a].inferenceInProgress
            ? -1
            : 1
      );

      const workerIdsToScaleDown = workerIdsByLoad.slice(
        0,
        numberOfExistingWorkers - count
      );

      const scaleDownPromises: Promise<any>[] = [];
      for (const workerId of workerIdsToScaleDown) {
        scaleDownPromises.push(
          this.llmEngine.unloadWorker(workerId, abruptKill)
        );
      }

      const results = await Promise.all(scaleDownPromises);
      return results;
    }
  }

  private connectP2PToPacketDB() {
    for (const p2pNetwork of this.p2pNetworkInstances) {
      const listener = p2pNetwork.listenForPacket(async (packet) => {
        await this.packetDB.receivePacket(packet);
      });

      this.shutdownListeners.push(() => listener());
    }
  }

  private connectPacketDBToPeerDB() {
    const listener = this.packetDB.subscribeToNewPackets(
      {
        receivedTimeAfter: new Date(),
      },
      (packet) => {
        console.log("Processing packet for peerdb ", packet);
        this.peerDB.processPacket(packet);
      }
    );

    this.shutdownListeners.push(() => listener());
  }

  private async broadcastPacket(packet: TransmittedPeerPacket): Promise<void> {
    await Promise.all(
      this.p2pNetworkInstances.map((p) => p.broadcastPacket(packet))
    );
  }

  async shutdownDomain() {
    for (const listener of this.shutdownListeners) {
      listener();
    }
  }

  public static async bootup({
    identityPassword,
    overwriteIdentity,
  }: DomainStartOptions) {
    if (TheDomain.instance) return TheDomain.instance;

    console.log("Booting up the the domain...");

    // Initialize client info

    // TODO: We probably want things to emit events we can save to the logs
    const clientInfo = await initClientInfo(
      identityPassword,
      overwriteIdentity
    );

    console.log("Identity retrieved/created successfully.");

    const p2pNetworkInstances: P2PNetworkInstance<any, any>[] = [];

    for (const network of P2PDeliveryNetworks) {
      if (THEDOMAIN_SETTINGS.enabledP2PNetworks.includes(network)) {
        console.log("Loading ", network, " network...");
        switch (network as SupportedP2PDeliveryNetwork) {
          case "gun":
            console.log("Initializing pewpewdb...");
            p2pNetworkInstances.push(
              new GunP2PNetworkInstance(clientInfo.synthientId, {
                gunPeers: GUNDB_CONFIG.bootstrapPeers,
                gunTopic: GUNDB_CONFIG.topic,
                startupDelayMs: GUNDB_CONFIG.bootFixedDelayMs,
              })
            );
            break;
          case "nkn":
            p2pNetworkInstances.push(
              new NknP2PNetworkInstance(clientInfo.synthientId, {
                nknTopic: NKN_CONFIG.topic,
                nknWalletPassword: "password",
              })
            );
            break;
          case "nostr":
            p2pNetworkInstances.push(
              new TrysteroP2PNetworkInstance(clientInfo.synthientId, {
                relayRedundancy: TRYSTERO_CONFIG.relayRedundancy,
                rtcConfig: TRYSTERO_CONFIG.rtcConfig,
                trysteroTopic: TRYSTERO_CONFIG.topic,
                trysteroAppId: TRYSTERO_CONFIG.appId,
                trysteroType: "nostr",
              })
            );
            break;
          case "torrent":
            p2pNetworkInstances.push(
              new TrysteroP2PNetworkInstance(clientInfo.synthientId, {
                relayRedundancy: TRYSTERO_CONFIG.relayRedundancy,
                rtcConfig: TRYSTERO_CONFIG.rtcConfig,
                trysteroTopic: TRYSTERO_CONFIG.topic,
                trysteroAppId: TRYSTERO_CONFIG.appId,
                trysteroType: "torrent",
              })
            );
            break;
          case "waku":
            console.log(
              "Waku attempted to load, but left unimplemented due to complexity and size."
            );
            break;
        }
      }
    }

    console.log("Initialized p2p networks, waiting for bootup...");

    const p2pLoadingResults: boolean[] = p2pNetworkInstances.map((p) => false);

    const waitingResult = await Promise.race([
      timeoutPromise(THEDOMAIN_SETTINGS.waitForP2PBootupMs),
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

    console.log("Connecting up working networks.");

    this.instance = new TheDomain(
      clientInfo,
      p2pNetworkInstances.filter((_, index) => p2pLoadingResults[index])
    );

    return this.instance;
  }
}
