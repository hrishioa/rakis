import Dexie, { type DexieOptions } from "dexie";
import { SupportedChains } from "./entities";
import {
  InferenceCommit,
  InferenceEmbedding,
  InferenceRequest,
  InferenceResult,
  InferenceSuccessResult,
  ReceivedPeerPacket,
  UnprocessedInferenceRequest,
} from "./packet-types";
import { sha256 } from "@noble/hashes/sha256";
import * as ed from "@noble/ed25519";
import { LLMModelName } from "../../llm/types";
import { generateRandomString } from "../utils/utils";
import EventEmitter from "eventemitter3";
import { createLogger, logStyles } from "../utils/logger";
import { QuorumDB } from "./quorumdb";

const logger = createLogger("InferenceDB", logStyles.databases.inferenceDB);

class InferenceEmbeddingDatabase extends Dexie {
  inferenceEmbeddings!: Dexie.Table<InferenceEmbedding, string>;

  constructor(options: DexieOptions = {}) {
    super("InferenceEmbeddingDB", options);
    this.version(1).stores({
      inferenceEmbeddings: "inferenceId, requestId, bEmbeddingHash",
    });
  }
}

class InferenceRequestDatabase extends Dexie {
  inferenceRequests!: Dexie.Table<InferenceRequest, string>;

  constructor(options: DexieOptions = {}) {
    super("InferenceRequestDB", options);
    this.version(1).stores({
      inferenceRequests:
        "requestId, fromChain, endingAt, payload.acceptedModels",
    });
  }
}

class InferenceResultDatabase extends Dexie {
  inferenceResults!: Dexie.Table<InferenceResult, string>;

  constructor(options: DexieOptions = {}) {
    super("InferenceResultDB", options);
    this.version(1).stores({
      inferenceResults: "inferenceId, requestId, startedAt, completedAt",
    });
  }
}

export type InferenceSelector = {
  requestId?: string;
  fromChains?: SupportedChains[];
  endingAfter?: Date;
  models?: LLMModelName[];
  active?: boolean; // Is this inference currently active, i.e are we before its endtime
};

export type InferenceDBEvents = {
  inferenceResultAwaitingEmbedding: (
    request: InferenceRequest,
    result: InferenceSuccessResult
  ) => void;
  newInferenceEmbedding: (embedding: InferenceEmbedding) => void;
  newActiveInferenceRequest: (request: InferenceRequest) => void;
  newInferenceRequest: (request: InferenceRequest) => void;
};

export class InferenceDB extends EventEmitter<InferenceDBEvents> {
  private inferenceRequestDb: InferenceRequestDatabase;
  private inferenceResultDb: InferenceResultDatabase;
  private inferenceEmbeddingDb: InferenceEmbeddingDatabase;
  private quorumDb: QuorumDB;
  // This should ideally be part of the db or a live query once the network is larger, has a chance of becoming problematic
  public activeInferenceRequests: InferenceRequest[] = [];
  private cleanupTimeout: NodeJS.Timeout | null = null;

  constructor(dbOptions: DexieOptions = {}) {
    super();
    this.inferenceRequestDb = new InferenceRequestDatabase(dbOptions);
    this.inferenceResultDb = new InferenceResultDatabase(dbOptions);
    this.inferenceEmbeddingDb = new InferenceEmbeddingDatabase(dbOptions);
    this.quorumDb = new QuorumDB();
  }

  private refreshCleanupTimeout() {
    if (this.cleanupTimeout) {
      clearTimeout(this.cleanupTimeout);
      this.cleanupTimeout = null;
    }

    const now = new Date();
    let shortestTimeout = Infinity;

    for (const inference of this.activeInferenceRequests) {
      const timeRemaining = inference.endingAt.getTime() - now.getTime();
      if (timeRemaining < shortestTimeout) {
        shortestTimeout = timeRemaining;
      }
    }

    if (shortestTimeout !== Infinity) {
      this.cleanupTimeout = setTimeout(() => {
        this.cleanupExpiredInferences();
      }, shortestTimeout);
    }
  }

  private async cleanupExpiredInferences() {
    const now = new Date();

    const matchingResults = (
      await this.inferenceResultDb.inferenceResults
        .where("requestId")
        .anyOf(
          this.activeInferenceRequests.map((inference) => inference.requestId)
        )
        .toArray()
    ).map((result) => result.requestId);

    logger.debug("Got matching results ", matchingResults);

    this.activeInferenceRequests = this.activeInferenceRequests.filter(
      (inference) =>
        !(inference.endingAt <= now) &&
        !matchingResults.includes(inference.requestId)
    );

    logger.debug(
      "Active inferences after cleanup",
      this.activeInferenceRequests.length
    );

    if (this.activeInferenceRequests.length > 0) {
      this.refreshCleanupTimeout();
    }
  }

  async saveInferenceEmbedding(
    inferenceResult: InferenceResult,
    inferenceEmbedding: InferenceEmbedding
  ) {
    // Check for matching inferenceResults
    const matchingResult = await this.inferenceResultDb.inferenceResults.get(
      inferenceResult.inferenceId
    );

    if (!matchingResult)
      throw new Error(
        `No matching inference result for embedding - ${inferenceResult.inferenceId}`
      );

    // Check for matching inferenceEmbeddings
    const existingEmbedding =
      await this.inferenceEmbeddingDb.inferenceEmbeddings.get(
        inferenceEmbedding.inferenceId
      );

    if (existingEmbedding) {
      logger.debug("Embedding already exists. Skipping save.");
      return;
    }

    await this.inferenceEmbeddingDb.inferenceEmbeddings.put(inferenceEmbedding);

    this.emit("newInferenceEmbedding", inferenceEmbedding);
  }

  async saveInferenceResult(inferenceResult: InferenceResult) {
    this.activeInferenceRequests = this.activeInferenceRequests.filter(
      (inference) => inference.requestId !== inferenceResult.requestId
    );

    await this.inferenceResultDb.inferenceResults.put(inferenceResult);

    if (inferenceResult.result.success) {
      // Get matching inferenceRequest and recheck
      const matchingRequest =
        await this.inferenceRequestDb.inferenceRequests.get(
          inferenceResult.requestId
        );

      if (matchingRequest && matchingRequest.endingAt > new Date()) {
        this.emit(
          "inferenceResultAwaitingEmbedding",
          matchingRequest,
          inferenceResult as InferenceSuccessResult
        );
      }
    }
  }

  async saveInferenceCommit(
    packet: Omit<ReceivedPeerPacket, "packet"> & { packet: InferenceCommit }
  ) {
    const matchingInferenceRequest =
      await this.inferenceRequestDb.inferenceRequests.get(
        packet.packet.requestId
      );

    if (!matchingInferenceRequest) {
      logger.error("No matching inference request for commit ", packet);
      return;
    }

    await this.quorumDb.processInferenceCommit(
      packet,
      matchingInferenceRequest
    );
  }

  async saveInferenceRequest(
    request: UnprocessedInferenceRequest
  ): Promise<void> {
    // Calculate a hash of the object values to use as the requestId
    const objectValues = Object.values(request.payload).join("");
    // TODO: Use a different source of randomness here, probably the txhash
    request.requestId ??=
      ed.etc.bytesToHex(sha256(objectValues)) + "." + generateRandomString(8);

    // Check if the request already exists in the database
    const existingRequest = await this.inferenceRequestDb.inferenceRequests.get(
      request.requestId
    );
    if (existingRequest) {
      logger.debug("Inference request already exists. Skipping save.");
      return;
    }

    // Calculate endingAt date from the securityFrame of the request
    const endingAt = new Date(
      new Date(request.payload.createdAt).getTime() +
        request.payload.securityFrame.maxTimeMs
    );
    request.endingAt = endingAt;

    const processedRequest: InferenceRequest = {
      ...request,
      endingAt,
      requestId: request.requestId!,
    };

    logger.debug("Saving ", processedRequest);

    // Save the request to the database
    await this.inferenceRequestDb.inferenceRequests.put(processedRequest);

    // Update the activeInferenceRequests array
    if (endingAt > new Date()) {
      this.activeInferenceRequests.push(processedRequest);

      logger.debug(
        "Active inferences after save",
        this.activeInferenceRequests.length
      );

      this.refreshCleanupTimeout();
    }

    // Notify subscribers of the new inference request
    // TODO: See if we can't make this an array, or just switch to
    // individual objects like in packetdb
    if (processedRequest.endingAt > new Date())
      setTimeout(
        () => this.emit("newActiveInferenceRequest", processedRequest),
        0
      );

    setTimeout(() => this.emit("newInferenceRequest", processedRequest), 0);
  }
}
