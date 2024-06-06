import { EmbeddingEngine } from "../../embeddings/embedding-engine";
import { EmbeddingModelName } from "../../embeddings/types";
import { LLMEngine } from "../../llm/llm-engine";
import { LLMModelName } from "../../llm/types";
import { GUNDB_CONFIG, NKN_CONFIG, TRYSTERO_CONFIG } from "../config";
import {
  P2PDeliveryNetworks,
  SupportedP2PDeliveryNetwork,
} from "../db/entities";
import { InferenceDB } from "../db/inferencedb";
import {
  InferenceEmbedding,
  InferenceRequest,
  InferenceResult,
  InferenceSuccessResult,
  TransmittedPeerPacket,
} from "../db/packet-types";
import { PacketDB } from "../db/packetdb";
import { PeerDB } from "../db/peerdb";
import { ClientInfo, initClientInfo } from "../identity";
import { NknP2PNetworkInstance } from "../p2p-networks/nkn";
import { P2PNetworkInstance } from "../p2p-networks/p2pnetwork-types";
import { GunP2PNetworkInstance } from "../p2p-networks/pewpewdb";
import { TrysteroP2PNetworkInstance } from "../p2p-networks/trystero";
import {
  generateRandomString,
  stringifyDateWithOffset,
  timeoutPromise,
} from "../utils/utils";
import { THEDOMAIN_SETTINGS } from "./settings";

export type DomainStartOptions = {
  identityPassword: string;
  overwriteIdentity?: boolean;
  initialEmbeddingWorkers: {
    modelName: EmbeddingModelName;
    count: number;
  }[];
  initialLLMWorkers: {
    modelName: LLMModelName;
    count: number;
  }[];
};

export class TheDomain {
  private static instance: TheDomain;

  private packetDB: PacketDB;
  private peerDB: PeerDB;
  private shutdownListeners: (() => void)[] = [];
  private embeddingEngine: EmbeddingEngine;
  private llmEngine: LLMEngine;
  private inferenceDB: InferenceDB;
  private inferenceStatus: {
    inferenceIdsInProcess: string[];
    inferenceCompletionInterval: NodeJS.Timeout | null;
    waitingForWorker: boolean;
    embeddingQueue: {
      request: InferenceRequest;
      result: InferenceSuccessResult;
      queued: boolean;
    }[];
  } = {
    inferenceIdsInProcess: [],
    inferenceCompletionInterval: null,
    waitingForWorker: false,
    embeddingQueue: [],
  };
  private inferenceRequestSubscription: null | (() => void) = null;

  private constructor(
    private clientInfo: ClientInfo,
    private p2pNetworkInstances: P2PNetworkInstance<any, any>[],
    initialEmbeddingWorkers: { modelName: EmbeddingModelName; count: number }[],
    initialLLMWorkers: { modelName: LLMModelName; count: number }[]
  ) {
    const broadcastPacket = async (packet: TransmittedPeerPacket) => {
      await Promise.all(
        this.p2pNetworkInstances.map((p) => p.broadcastPacket(packet))
      );
    };

    this.packetDB = new PacketDB(clientInfo, broadcastPacket);
    this.peerDB = new PeerDB();
    this.inferenceDB = new InferenceDB();

    this.inferenceDB.on(
      "inferenceResultAwaitingEmbedding",
      (request, result) => {
        console.log("New inference awaiting embedding");
        this.inferenceStatus.embeddingQueue.push({
          request,
          result,
          queued: false,
        });
        setTimeout(() => this.processInferenceEmbeddings(), 0);
      }
    );

    this.inferenceDB.on("newInferenceEmbedding", (embedding) => {
      console.log("New inference embedding, committing to result");
      this.onInferenceEmbedding(embedding);
    });

    console.log("Databases created.");
    this.connectP2PToPacketDB();
    this.connectPacketDBToPeerDB();
    // TODO: Again, might be deprecated later
    this.connectPacketDBToInferenceDB();

    this.embeddingEngine = new EmbeddingEngine();

    this.embeddingEngine.on("workerFree", () => {
      console.log("Worker free, checking for jobs");
      setTimeout(() => this.processInferenceEmbeddings(), 0);
    });

    this.llmEngine = new LLMEngine();
    this.llmEngine.on("workerFree", () => {
      console.log("Worker free, checking for jobs");
      setTimeout(() => this.processInferenceRequests(), 0);
    });

    console.log("Starting workers...");

    const workerStartPromises: Promise<any>[] = [];
    for (const worker of initialEmbeddingWorkers) {
      workerStartPromises.push(
        this.updateEmbeddingWorkers(worker.modelName, worker.count)
      );
    }
    for (const worker of initialLLMWorkers) {
      workerStartPromises.push(
        this.updateLLMWorkers(worker.modelName, worker.count)
      );
    }

    this.updateInferenceSubscription();

    this.packetDB.transmitPacket({
      type: "peerStatusUpdate",
      status: "boot",
      createdAt: stringifyDateWithOffset(new Date()),
    });

    // Await the promise if we want to block, but we're fine without I think

    if (typeof window !== "undefined") {
      (window as any).theDomain = {
        runInference: (
          prompt: string,
          model: LLMModelName,
          maxTimeMs: number
        ) => {
          this.packetDB.transmitPacket({
            type: "p2pInferenceRequest",
            requestId: generateRandomString(10),
            payload: {
              fromChain: "ecumene",
              blockNumber: 0,
              createdAt: stringifyDateWithOffset(new Date()),
              prompt,
              acceptedModels: [model],
              temperature: 1,
              maxTokens: 2048,
              securityFrame: {
                quorum: 10,
                maxTimeMs,
                secDistance: 0.9,
                secPercentage: 0.5,
                embeddingModel: "nomic-ai/nomic-embed-text-v1.5",
              },
            },
            createdAt: stringifyDateWithOffset(new Date()),
          });
        },
        updateLLMWorkers: (modelName: LLMModelName, count: number) => {
          this.updateLLMWorkers(modelName, count);
        },
        llmEngine: this.llmEngine,
      };

      console.log("Inference request function exposed.");
    }
  }

  private onInferenceEmbedding(inferenceEmbedding: InferenceEmbedding) {
    this.packetDB.transmitPacket({
      type: "inferenceCommit",
      bEmbeddingHash: inferenceEmbedding.bEmbeddingHash,
      requestId: inferenceEmbedding.requestId,
      inferenceId: inferenceEmbedding.inferenceId,
      createdAt: stringifyDateWithOffset(new Date()),
    });
  }

  private updateInferenceSubscription() {
    if (this.inferenceRequestSubscription) {
      this.inferenceRequestSubscription();
    }

    this.inferenceRequestSubscription = this.inferenceDB.subscribeToInferences(
      {
        active: true,
        models: Array.from(
          new Set(
            Object.values(this.llmEngine.llmWorkers).map(
              (worker) => worker.modelName
            )
          )
        ),
      },
      (packet) => {
        console.log("Starting new inference loop because of incoming packet.");
        setTimeout(() => this.processInferenceRequests(), 0);
      }
    );
  }

  private processInferenceEmbeddings() {
    const runId = generateRandomString(3);

    console.log(runId, ": Starting embedding process.");

    const availableModels = this.embeddingEngine.getAvailableModels();

    console.log(runId, ": Available models - ", availableModels);

    // Put the soonest ending ones first, let's try and race
    this.inferenceStatus.embeddingQueue = this.inferenceStatus.embeddingQueue
      .filter((item) => item.request.endingAt > new Date())
      .sort(
        (a, b) => a.request.endingAt.getTime() - b.request.endingAt.getTime()
      );

    console.log(
      runId,
      ": Sorted embedding queue - ",
      this.inferenceStatus.embeddingQueue
    );

    const validInferenceResults = this.inferenceStatus.embeddingQueue.filter(
      (item) =>
        !item.queued &&
        availableModels.includes(
          item.request.payload.securityFrame.embeddingModel
        )
    );

    console.log(runId, ": Valid inference results - ", validInferenceResults);

    const usableModels = Array.from(
      new Set(
        validInferenceResults.map(
          (item) => item.request.payload.securityFrame.embeddingModel
        )
      )
    );

    console.log(runId, ": Usable models - ", usableModels);

    const availableWorkers = Object.values(
      this.embeddingEngine.embeddingWorkers
    ).filter(
      (worker) => !worker.busy && usableModels.includes(worker.modelName)
    );

    console.log(runId, ": Available workers - ", availableWorkers);

    if (availableWorkers.length && validInferenceResults.length)
      this.packetDB.transmitPacket({
        type: "peerStatusUpdate",
        status: "computing_bEmbeddingHash",
        embeddingModels: usableModels,
        createdAt: stringifyDateWithOffset(new Date()),
      });

    for (
      let i = 0;
      i < Math.min(availableWorkers.length, validInferenceResults.length);
      i++
    ) {
      validInferenceResults[i].queued = true;

      // We're doing these one by one for now since we're not sure if running them
      // as a batch will influence the embeddings
      // TODO: For someone else to test
      console.log("Embedding ", validInferenceResults[i].result.result);

      this.embeddingEngine
        .embedText(
          [validInferenceResults[i].result.result.result],
          validInferenceResults[i].request.payload.securityFrame.embeddingModel
        )
        .then((embeddingResults) => {
          console.log(
            "Embedded ",
            validInferenceResults[i].result.result.result,
            " - ",
            embeddingResults
          );

          this.inferenceStatus.embeddingQueue =
            this.inferenceStatus.embeddingQueue.filter(
              (item) => item !== validInferenceResults[i]
            );

          if (embeddingResults && embeddingResults.length) {
            const embeddingResult = embeddingResults[0];
            this.inferenceDB.saveInferenceEmbedding(
              validInferenceResults[i].result,
              {
                inferenceId: validInferenceResults[i].result.inferenceId,
                requestId: validInferenceResults[i].result.requestId,
                embedding: embeddingResult.embedding,
                bEmbedding: embeddingResult.binaryEmbedding,
                bEmbeddingHash: embeddingResult.bEmbeddingHash,
              }
            );
          } else {
            // TODO: Log an error?
            console.error(
              "Could not inference ",
              validInferenceResults[i].result.result.result,
              " for unknown reason to caller"
            );
          }
        })
        .catch((err) => {
          this.inferenceStatus.embeddingQueue =
            this.inferenceStatus.embeddingQueue.filter(
              (item) => item !== validInferenceResults[i]
            );

          console.error(
            "Error embedding ",
            validInferenceResults[i].result.result.result,
            " - ",
            err
          );
        });
    }
  }

  private processInferenceRequests() {
    const cycleId = generateRandomString(3);

    const availableInferenceRequests =
      this.inferenceDB.activeInferenceRequests.filter(
        (inferenceRequest) =>
          inferenceRequest.endingAt > new Date() &&
          !this.inferenceStatus.inferenceIdsInProcess.includes(
            inferenceRequest.requestId
          )
      );

    console.log(
      cycleId,
      ": Found ",
      availableInferenceRequests.length,
      " available inference requests."
    );

    const neededModels = Array.from(
      new Set(
        availableInferenceRequests
          .map((inferenceRequest) => inferenceRequest.payload.acceptedModels)
          .flat()
      )
    );

    console.log(cycleId, ": Models needed - ", neededModels);

    const llmWorkerAvailability =
      this.llmEngine.getWorkerAvailability(neededModels);

    console.log(cycleId, ": Worker availability - ", llmWorkerAvailability);

    const possibleInferences = availableInferenceRequests.filter(
      (inferenceRequest) =>
        inferenceRequest.payload.acceptedModels.some(
          (model) =>
            llmWorkerAvailability[model] &&
            llmWorkerAvailability[model].free > 0
        )
    );

    console.log(cycleId, ": Possible inferences - ", possibleInferences);

    if (!possibleInferences.length) {
      console.log(cycleId, ": No possible inferences, going back to sleep.");
      return;
    }

    const selectedInference = possibleInferences.sort((a, b) => {
      return b.endingAt.getTime() - a.endingAt.getTime();
    })[0];

    console.log(
      cycleId,
      ": Selected inference - ",
      selectedInference.requestId
    );

    this.inferenceStatus.inferenceIdsInProcess.push(
      selectedInference.requestId
    );

    const inferenceStartedAt = new Date();

    this.packetDB.transmitPacket({
      type: "peerStatusUpdate",
      status: "inferencing",
      modelName: selectedInference.payload.acceptedModels[0],
      createdAt: stringifyDateWithOffset(new Date()),
    });

    this.llmEngine
      .runInferenceNonStreaming({
        modelName: selectedInference.payload.acceptedModels[0],
        messages: [{ role: "user", content: selectedInference.payload.prompt }],
      })
      .then((response) => {
        console.log(
          cycleId,
          ": Inference completed for ",
          selectedInference.requestId,
          " - ",
          response
        );

        const inferenceEndedAt = new Date();

        if (response.success) {
          const inferenceSeconds =
            inferenceEndedAt.getTime() / 1000 -
            inferenceStartedAt.getTime() / 1000;
          const tps =
            response.tokenCount && inferenceSeconds
              ? response.tokenCount / inferenceSeconds
              : 0;

          this.packetDB.transmitPacket({
            type: "peerStatusUpdate",
            status: "completed_inference",
            modelName: selectedInference.payload.acceptedModels[0],
            tps,
            createdAt: stringifyDateWithOffset(new Date()),
          });
        }

        return this.inferenceDB.saveInferenceResult({
          requestId: selectedInference.requestId,
          inferenceId:
            selectedInference.requestId + "." + generateRandomString(),
          startedAt: stringifyDateWithOffset(inferenceStartedAt),
          completedAt: stringifyDateWithOffset(new Date()),
          result: response,
        });
      })
      .then(() => {
        this.inferenceStatus.inferenceIdsInProcess =
          this.inferenceStatus.inferenceIdsInProcess.filter(
            (id) => id !== selectedInference.requestId
          );
      })
      .catch((err) => {
        console.error(cycleId, ": Error running inference - ", err);

        return this.inferenceDB.saveInferenceResult({
          requestId: selectedInference.requestId,
          inferenceId:
            selectedInference.requestId + "." + generateRandomString(),
          startedAt: stringifyDateWithOffset(inferenceStartedAt),
          completedAt: stringifyDateWithOffset(new Date()),
          result: {
            success: false,
            error: err,
          },
        });
      });

    console.log("looking for next inference, waiting a tick.");
    setTimeout(() => this.processInferenceRequests(), 0);
  }

  // TODOs:
  // 1. Register error handlers for the p2p networks, and restart them (some finite number of times) if they error out
  // 2. Expose a packet subscriber to the outside in case someone wants to listen in

  private async updateEmbeddingWorkers(
    modelName: EmbeddingModelName,
    count: number,
    abruptKill: boolean = false
  ) {
    const numberOfExistingWorkers = Object.values(
      this.embeddingEngine.embeddingWorkers
    ).filter((worker) => worker.modelName === modelName).length;

    if (numberOfExistingWorkers === count) return;

    if (numberOfExistingWorkers < count) {
      console.log(
        "Scaling up number of embedding workers for ",
        modelName,
        " to ",
        count
      );
      for (let i = 0; i < count - numberOfExistingWorkers; i++) {
        const workerId = `embedding-${modelName}-${generateRandomString()}`;
        this.embeddingEngine.addEmbeddingWorker(modelName, workerId);
        this.packetDB.transmitPacket({
          type: "peerStatusUpdate",
          createdAt: stringifyDateWithOffset(new Date()),
          status: "loaded_worker",
          modelName,
          workerId,
        });
      }
    } else {
      console.log(
        "Scaling down number of embedding workers for ",
        modelName,
        " to ",
        count
      );

      const workerIdsByLoad = Object.keys(
        this.embeddingEngine.embeddingWorkers
      ).sort((a, b) =>
        this.embeddingEngine.embeddingWorkers[a].busy ===
        this.embeddingEngine.embeddingWorkers[b].busy
          ? 0
          : this.embeddingEngine.embeddingWorkers[a].busy
          ? -1
          : 1
      );

      const workerIdsToScaleDown = workerIdsByLoad.slice(
        0,
        numberOfExistingWorkers - count
      );

      for (const workerId of workerIdsToScaleDown) {
        this.embeddingEngine.deleteEmbeddingWorker(workerId);
      }
    }
  }

  async updateLLMWorkers(
    modelName: LLMModelName,
    count: number,
    abruptKill: boolean = false
  ) {
    try {
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

        // TODO: Process errors
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

        // TODO: Process errors
      }
    } catch (err) {
      console.error("Domain: Error updating LLM workers", err);
    }

    this.updateInferenceSubscription();
  }

  private connectPacketDBToInferenceDB() {
    this.packetDB.off("newP2PInferenceRequest");

    this.packetDB.on("newP2PInferenceRequest", (packet) => {
      console.log("Saving p2p inference request to our db");
      this.inferenceDB.saveInferenceRequest({
        fetchedAt: new Date(),
        requestId: packet.requestId,
        payload: packet.payload,
      });
    });

    console.log("Connected p2pinference requests from packetdb to inferencedb");
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

  async shutdownDomain() {
    for (const listener of this.shutdownListeners) {
      listener();
    }
  }

  public static async bootup({
    identityPassword,
    overwriteIdentity,
    initialEmbeddingWorkers,
    initialLLMWorkers,
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
      p2pNetworkInstances.filter((_, index) => p2pLoadingResults[index]),
      initialEmbeddingWorkers,
      initialLLMWorkers
    );

    return this.instance;
  }
}
