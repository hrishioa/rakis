import Dexie from "dexie";
import {
  InferenceCommit,
  InferenceRequest,
  ReceivedPeerPacket,
  TransmittedPeerPacket,
} from "./packet-types";
import { createLogger, logStyles } from "../utils/logger";

const logger = createLogger("QuorumDB", logStyles.databases.quorumDB);

export type InferenceQuorum = {
  requestId: string;
  status: "awaiting_commitments" | "awaiting_reveal" | "failed" | "completed";
  quorumThreshold: number;
  endingAt: Date; // Stringified date
  quorumCommitted: number; // Number of peers that have committed a hash
  quorumRevealed: number; // Number of peers that have revealed their embedding
  quorum: {
    inferenceId: string;
    synthientId: string;
    bEmbeddingHash: string;
    commitReceivedAt: Date;
    reveal?: {
      embedding: number[];
      bEmbedding: number[];
      output: string;
      receivedAt: Date;
    };
  }[];
};

class QuorumDatabase extends Dexie {
  quorums!: Dexie.Table<InferenceQuorum, string>;

  constructor() {
    super("QuorumDatabase");
    this.version(1).stores({
      quorums:
        "requestId, status, endingAt, thresholdMet, quorumCommitted, quorumRevealed",
    });
  }
}

export class QuorumDB {
  private db: QuorumDatabase;
  private quorumRevealTimeout: NodeJS.Timeout | null = null;

  constructor() {
    this.db = new QuorumDatabase();
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
      this.quorumRevealTimeout = setTimeout(() => {
        logger.debug("TODO: Check and ask for reveal here");

        setTimeout(() => this.refreshQuorumRevealTimeout(), 0); // polite timeout
      }, quorums[0].endingAt.getTime() - Date.now());
    }
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
