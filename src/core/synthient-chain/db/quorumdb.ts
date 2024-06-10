import Dexie from "dexie";
import {
  InferenceCommit,
  InferenceQuorumComputed,
  InferenceRequest,
  InferenceReveal,
  PeerPacket,
  ReceivedPeerPacket,
} from "./packet-types";
import { createLogger, logStyles } from "../utils/logger";
import { QUORUM_SETTINGS } from "../thedomain/settings";
import EventEmitter from "eventemitter3";
import { EmbeddingResult } from "../embeddings/types";
import { runFinalConsensus } from "../consensus/consensus-core";
import { InferenceQuorum, ConsensusResults, QuorumDBEvents } from "./entities";

const logger = createLogger("QuorumDB", logStyles.databases.quorumDB);

class QuorumDatabase extends Dexie {
  quorums!: Dexie.Table<InferenceQuorum, string>;

  constructor() {
    super("QuorumDatabase");
    this.version(1).stores({
      quorums:
        "requestId, status, endingAt, thresholdMet, quorumCommitted, quorumRevealed, consensusRequestedAt",
    });
  }
}

class ConsensusResultsDatabase extends Dexie {
  consensusResults!: Dexie.Table<ConsensusResults, string>;

  constructor() {
    super("ConsensusResultsDatabase");
    this.version(1).stores({
      consensusResults: "requestId, success, reason",
    });
  }
}

class ExternalConsensusResultsDatabase extends Dexie {
  consensusResults!: Dexie.Table<InferenceQuorumComputed, string>;

  constructor() {
    super("ExternalConsensusResultsDatabase");
    this.version(1).stores({
      consensusResults: "[requestId+verifiedBy]",
    });
  }
}

export class QuorumDB extends EventEmitter<QuorumDBEvents> {
  private db: QuorumDatabase;
  private consensusResultsDB: ConsensusResultsDatabase;
  private externalConsensusResultsDB: ExternalConsensusResultsDatabase;
  private quorumRevealTimeout: NodeJS.Timeout | null = null;
  private quorumConsensusTimeout: NodeJS.Timeout | null = null;

  constructor(private mySynthientId: string) {
    super();
    this.db = new QuorumDatabase();
    this.consensusResultsDB = new ConsensusResultsDatabase();
    this.externalConsensusResultsDB = new ExternalConsensusResultsDatabase();
  }

  async getQuorum(requestId: string) {
    return this.db.quorums.get(requestId);
  }

  async getQuorums(requestIds: string[]) {
    return this.db.quorums.where("requestId").anyOf(requestIds).toArray();
  }

  async getConsensusResults(requestIds: string[]) {
    return this.consensusResultsDB.consensusResults
      .where("requestId")
      .anyOf(requestIds)
      .toArray();
  }

  async getExternalConsensusResults(requestIds: string[]) {
    return this.externalConsensusResultsDB.consensusResults
      .where("requestId")
      .anyOf(requestIds)
      .toArray();
  }

  private async checkQuorumsReadyForReveal() {
    logger.debug("Checking quorums for reveal");

    // Find quorums where they've already ended (endingAt is in the past)
    // But the endingAt+quorumRevealRequestIssueTimeoutMs hasn't ended
    // And the quorums is still awaiting_commitments
    const currentTime = new Date();
    const revealStartTime = new Date(
      currentTime.getTime() - QUORUM_SETTINGS.quorumRevealRequestIssueTimeoutMs
    );

    const candidateQuorums = (
      await this.db.quorums
        .where("endingAt")
        .between(revealStartTime, currentTime)
        .toArray()
    ).filter((quorum) => quorum.status === "awaiting_commitments");

    const failedQuorums = candidateQuorums.filter(
      (quorum) => quorum.quorum.length < quorum.quorumThreshold
    );

    logger.debug("Quorums that failed: ", failedQuorums);

    failedQuorums.forEach((quorum) => (quorum.status = "failed"));

    await this.db.quorums.bulkPut(failedQuorums).catch(Dexie.BulkError, (e) => {
      logger.error("Failed to update quorums to failed for these quorums: ", e);
    });

    const successfulQuorums = candidateQuorums.filter(
      (quorum) => quorum.quorum.length >= quorum.quorumThreshold
    );

    logger.debug("Quorums that passed: ", successfulQuorums);

    successfulQuorums.forEach((quorum) => (quorum.status = "awaiting_reveal"));

    await this.db.quorums
      .bulkPut(successfulQuorums)
      .catch(Dexie.BulkError, (e) => {
        logger.error(
          "Failed to update quorums to awaiting_reveal for these quorums: ",
          e
        );
      });

    if (successfulQuorums.length) {
      this.emit("requestReveal", successfulQuorums);
    }
  }

  async processInferenceReveal(
    revealPacket: Omit<ReceivedPeerPacket, "packet"> & {
      packet: InferenceReveal;
    }
  ) {
    // Find matching quorum

    const quorum = await this.db.quorums.get(revealPacket.packet.requestId);

    if (!quorum) {
      logger.debug("No quorum found for reveal packet ", revealPacket);
      return;
    }

    if (
      revealPacket.receivedTime &&
      revealPacket.receivedTime.getTime() >
        quorum.endingAt.getTime() + QUORUM_SETTINGS.quorumRevealTimeoutMs
    ) {
      logger.debug(
        "Received reveal packet after reveal timeout ",
        revealPacket,
        " discarding"
      );
      return;
    }

    const commit = quorum.quorum.find(
      (commit) =>
        commit.synthientId === revealPacket.synthientId &&
        commit.inferenceId === revealPacket.packet.inferenceId
    );

    if (!commit) {
      logger.debug("No commit found for reveal packet ", revealPacket);
      return;
    }

    if (commit.reveal) {
      // logger.debug("Commit already has a reveal ", commit);
      return;
    }
    // TODO: IMPORTANT Validate the actual reveal before adding it to our quorum
    // by double checking the embeddings and hash

    commit.reveal = {
      embedding: revealPacket.packet.embedding,
      bEmbedding: revealPacket.packet.bEmbedding,
      output: revealPacket.packet.output,
      receivedAt: new Date(),
    };

    quorum.quorumRevealed += 1;

    await this.db.quorums.put(quorum);

    logger.debug("Updated quorum with reveal: ", quorum);

    await this.checkQuorumsReadyForConsensus();
  }

  private async checkQuorumsReadyForConsensus() {
    if (this.quorumConsensusTimeout) clearTimeout(this.quorumConsensusTimeout);

    const now = new Date();
    const timeoutRevealWindow = new Date(
      now.getTime() - QUORUM_SETTINGS.quorumRevealTimeoutMs
    );
    const consensusProcessingWindow = new Date(
      now.getTime() -
        QUORUM_SETTINGS.quorumRevealTimeoutMs -
        QUORUM_SETTINGS.quorumConsensusWindowMs
    );

    const quorums = (
      await this.db.quorums
        .where("endingAt")
        .between(consensusProcessingWindow, timeoutRevealWindow)
        .toArray()
    ).filter(
      (quorum) =>
        quorum.status === "awaiting_reveal" && !quorum.consensusRequestedAt
    );

    logger.debug("Quorums ready for consensus processing: ", quorums);

    for (const quorum of quorums) {
      if (quorum.quorumRevealed < quorum.quorumThreshold) {
        logger.debug(
          "Quorum didn't meet threshold for consensus processing: ",
          quorum
        );

        quorum.status = "failed";
        continue;
      }

      quorum.status = "awaiting_consensus";
      quorum.consensusRequestedAt = new Date();

      logger.debug("Emitting newQuorumAwaitingConsensus for quorum: ", quorum);
      this.emit(
        "newQuorumAwaitingConsensus",
        quorum.requestId,
        quorum.embeddingModel,
        quorum.consensusRequestedAt!,
        quorum.quorum.some(
          (commit) => commit.synthientId === this.mySynthientId
        )
      );
    }

    await this.db.quorums.bulkPut(quorums).catch(Dexie.BulkError, (e) => {
      logger.error(
        "Failed to update quorums to awaiting_consensus for these quorums: ",
        e
      );
    });

    const quorumsAboutToNeedChecking = (
      await this.db.quorums
        .where("endingAt")
        .above(timeoutRevealWindow)
        .toArray()
    )
      .filter((quorum) => quorum.status === "awaiting_reveal")
      .sort((a, b) => a.endingAt.getTime() - b.endingAt.getTime());

    if (quorumsAboutToNeedChecking.length) {
      logger.debug(
        "Setting timeout for next quorum check: ",
        quorumsAboutToNeedChecking[0],
        " as ",
        quorumsAboutToNeedChecking[0].endingAt.getTime() -
          Date.now() +
          QUORUM_SETTINGS.quorumRevealTimeoutMs -
          10
      );

      this.quorumConsensusTimeout = setTimeout(
        () => this.checkQuorumsReadyForConsensus(),
        quorumsAboutToNeedChecking[0].endingAt.getTime() +
          QUORUM_SETTINGS.quorumRevealTimeoutMs -
          Date.now() +
          10
      );
    }
  }

  async getQuorumConsensusQueue() {
    const now = new Date();
    // Subtract QUORUM_SETTINGS.quorumConsensusWindowMs from now
    const revealStartTime = new Date(
      now.getTime() - QUORUM_SETTINGS.quorumConsensusWindowMs
    );

    // Get the quorum that's still awaiting_consensus with the soonest endingAt
    const quorumConsensusQueue = (
      await this.db.quorums
        .where("consensusRequestedAt")
        .above(revealStartTime)
        .toArray()
    )
      .filter((quorum) => !!quorum.consensusRequestedAt)
      .sort(
        (a, b) =>
          a.consensusRequestedAt!.getTime() - b.consensusRequestedAt!.getTime()
      );

    return quorumConsensusQueue;
  }

  private async refreshQuorumRevealTimeout() {
    if (this.quorumRevealTimeout) {
      clearTimeout(this.quorumRevealTimeout);
    }

    // Get the quorum that's still awaiting_commitments with the soonest endingAt
    const quorums = (
      await this.db.quorums.where("endingAt").above(new Date()).toArray()
    )
      .filter((quorum) => quorum.status === "awaiting_commitments")
      .sort((a, b) => a.endingAt.getTime() - b.endingAt.getTime());

    logger.debug("Got quorums for setting Timeout: ", quorums);

    if (quorums.length) {
      this.quorumRevealTimeout = setTimeout(async () => {
        logger.debug("Timeout for quorum reveal");

        await this.checkQuorumsReadyForReveal();

        setTimeout(() => this.refreshQuorumRevealTimeout(), 0); // polite timeout
      }, quorums[0].endingAt.getTime() - Date.now());
    }
  }

  async processExternalConsensus(consensusPacket: InferenceQuorumComputed) {
    const existingExternalConsensus =
      await this.externalConsensusResultsDB.consensusResults.get([
        consensusPacket.requestId,
        consensusPacket.verifiedBy,
      ]);

    if (existingExternalConsensus) {
      logger.debug(
        "External consensus already exists for this request and synthientId: ",
        consensusPacket,
        ", dropping"
      );
      return;
    }

    this.externalConsensusResultsDB.consensusResults.put(consensusPacket);
  }

  async processVerifiedConsensusEmbeddings(
    request: InferenceRequest,
    results: EmbeddingResult[]
  ) {
    logger.debug(
      "Processing verified consensus embeddings: ",
      results,
      " for request: ",
      request
    );

    await this.db.quorums.update(request.requestId, {
      status: "verifying_consensus",
    });

    const quorum = await this.db.quorums.get(request.requestId);

    if (!quorum) {
      logger.error("No quorum found for request ", request);
      return;
    }

    const finalResults = await runFinalConsensus(
      quorum,
      results,
      this.mySynthientId,
      request.payload.securityFrame
    );

    logger.debug("Final results: ", finalResults);

    this.consensusResultsDB.consensusResults.put(finalResults);

    const consensusPackets: PeerPacket[] = finalResults.rejectionPackets;

    if (finalResults.success) {
      if (finalResults.computedQuorumPacket)
        consensusPackets.push(finalResults.computedQuorumPacket);

      this.db.quorums.update(request.requestId, {
        status: "completed",
      });
    } else {
      this.db.quorums.update(request.requestId, {
        status: "failed",
      });
    }

    this.emit("consensusPackets", consensusPackets);
  }

  async processInferenceCommit(
    packet: Omit<ReceivedPeerPacket, "packet"> & { packet: InferenceCommit },
    request: InferenceRequest
  ) {
    // Check if the inferenceQuorum exists, if not create it
    // if it exists, add this commit to the quorum but don't replace an existing one

    const quorum = await this.db.quorums.get(packet.packet.requestId);

    logger.debug("Seeing if we should insert commit ", packet);

    if (!quorum) {
      logger.debug("Creating new quorum for commit - ", packet);

      this.db.quorums.put({
        requestId: packet.packet.requestId,
        status: "awaiting_commitments",
        quorumThreshold: request.payload.securityFrame.quorum,
        endingAt: request.endingAt,
        quorumCommitted: 1,
        quorumRevealed: 0,
        embeddingModel: request.payload.securityFrame.embeddingModel,
        quorum: [
          {
            inferenceId: packet.packet.inferenceId,
            synthientId: packet.synthientId,
            bEmbeddingHash: packet.packet.bEmbeddingHash,
            commitReceivedAt: new Date(),
          },
        ],
      });
    } else {
      if (
        !quorum.quorum.find(
          (commit) =>
            commit.synthientId === packet.synthientId &&
            commit.inferenceId === packet.packet.inferenceId
        )
      ) {
        logger.debug("Adding new commit to quorum - ", quorum);

        quorum.quorum.push({
          inferenceId: packet.packet.inferenceId,
          synthientId: packet.synthientId,
          bEmbeddingHash: packet.packet.bEmbeddingHash,
          commitReceivedAt: new Date(),
        });

        quorum.quorumCommitted += 1;

        logger.debug("New commit to add to quorum - ", quorum);

        this.db.quorums.put(quorum);
      } else {
        logger.debug("Commit already exists in quorum - ", quorum);
      }
    }

    this.refreshQuorumRevealTimeout();
  }
}
