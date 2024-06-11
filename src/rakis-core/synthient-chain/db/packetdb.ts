import Dexie, { DexieOptions } from "dexie";
import * as ed from "@noble/ed25519";
import {
  InferenceCommit,
  InferenceQuorumComputed,
  InferenceReveal,
  InferenceRevealRequest,
  KnownPeers,
  P2PInferenceRequestPacket,
  PeerHeart,
  type PeerPacket,
  type ReceivedPeerPacket,
  type TransmittedPeerPacket,
} from "./packet-types";
import type { ClientInfo } from "../identity";
import { sha512 } from "@noble/hashes/sha512";
import {
  signJSONObject,
  verifySignatureOnJSONObject,
} from "../utils/simple-crypto";
import EventEmitter from "eventemitter3";
import { PeerDB } from "./peerdb";
import { createLogger, logStyles } from "../utils/logger";
import { PacketDBEvents } from "./entities";
import { PACKET_DB_SETTINGS } from "../thedomain/settings";
import { debounce } from "lodash";
import { stringifyDateWithOffset } from "../utils/utils";

const logger = createLogger("PacketDB", logStyles.databases.packetDB);

ed.etc.sha512Sync = (...m) => sha512(ed.etc.concatBytes(...m));

type SendPacketOverP2PFunc = (packet: TransmittedPeerPacket) => Promise<void>;

// TODO: Consider keeping createdAt time as a separate date field on the outside, as a Date object in the db for better indexing

// Define the database schema
class PacketDatabase extends Dexie {
  packets!: Dexie.Table<ReceivedPeerPacket, string>;

  constructor(options: DexieOptions = {}) {
    super("PacketDatabase", options);
    this.version(1).stores({
      packets:
        "[synthientId+signature], synthientId, packet.type, packet.requestId, packet.inferenceId, receivedTime",
    });
  }
}

export class PacketDB extends EventEmitter<PacketDBEvents> {
  private db: PacketDatabase;
  public peerDB: PeerDB;
  private receivedPacketQueue: ReceivedPeerPacket[] = [];

  constructor(
    private clientInfo: ClientInfo,
    private sendPacketOverP2P: SendPacketOverP2PFunc,
    dbOptions: DexieOptions = {}
  ) {
    super();
    this.db = new PacketDatabase(dbOptions);
    this.peerDB = new PeerDB();
    this.clientInfo = clientInfo;
    this.sendPacketOverP2P = sendPacketOverP2P;
  }

  async getLastPackets(count: number): Promise<{
    packets: ReceivedPeerPacket[];
    total: number;
  }> {
    return {
      packets: await this.db.packets
        .orderBy("receivedTime")
        .reverse()
        .limit(count)
        .toArray(),
      total: await this.db.packets.count(),
    };
  }

  async emitNewPacketEvents(packet: ReceivedPeerPacket) {
    if (packet.packet.type === "p2pInferenceRequest") {
      this.emit(
        "newP2PInferenceRequest",
        packet.packet as P2PInferenceRequestPacket
      );
    }

    if (packet.packet.type === "inferenceQuorumComputed") {
      if (packet.packet.verifiedBy !== packet.synthientId) {
        // TODO: In the future we can add some actual verification and propagation between nodes in case we want to implement that *above* the p2p layer, for now you shouldn't really be getting them from someone else
        logger.debug(
          "Received inferenceQuorumComputed not directly from the sender, dropping",
          packet
        );
      } else {
        this.emit(
          "consensusPacketReceived",
          packet.packet as InferenceQuorumComputed
        );
      }
    }

    if (packet.packet.type === "inferenceCommit") {
      this.emit(
        "newInferenceCommit",
        packet as Omit<ReceivedPeerPacket, "packet"> & {
          packet: InferenceCommit;
        }
      );
    }

    if (packet.packet.type === "inferenceRevealRequest") {
      this.validateInferenceRevealRequest(packet);
    }

    if (packet.packet.type == "inferenceReveal") {
      // Emitting all revealed inferences for now, we'll filter them out at the
      // inferencedb. We've been assured by Claude that this passing is by reference,
      // we'll choose to trust this - FOR NOW
      this.emit(
        "newInferenceRevealed",
        packet as Omit<ReceivedPeerPacket, "packet"> & {
          packet: InferenceReveal;
        }
      );
    }
  }

  async validateInferenceRevealRequest(packet: ReceivedPeerPacket) {
    if (packet.packet.type !== "inferenceRevealRequest") return;

    if (
      packet.packet.quorum.some(
        (inference) => inference.synthientId === this.clientInfo.synthientId
      )
    ) {
      logger.debug("Received inferenceRevealRequest for own synthientId");
      this.emit(
        "newInferenceRevealRequest",
        packet as Omit<ReceivedPeerPacket, "packet"> & {
          packet: InferenceRevealRequest;
        }
      );
    }
  }

  async transmitPacket(packet: PeerPacket): Promise<void> {
    // Create the transmitted packet
    const transmittedPacket: TransmittedPeerPacket = {
      synthientId: this.clientInfo.synthientId,
      signature: "", // Will be set later
      packet,
    };

    transmittedPacket.signature = signJSONObject(
      this.clientInfo.synthientPrivKey,
      packet
    );

    // Save the packet in the database
    await this.db.packets.add({
      ...transmittedPacket,
      // receivedTime: undefined, // Set as undefined since it's our own packet
    });

    this.emitNewPacketEvents(transmittedPacket);

    logger.debug(
      `Transmitting packet ${transmittedPacket.packet.type}`,
      transmittedPacket
    );

    // Send the packet over the P2P network
    await this.sendPacketOverP2P(transmittedPacket);
  }

  // Expensive, primarily for testing, if you're calling this otherwise please rethink your life choices
  async getAllPackets() {
    return await this.db.packets.toArray();
  }

  private fixEmbeddingArraysInPackets(packet: ReceivedPeerPacket) {
    if (packet.packet.type === "inferenceReveal") {
      packet.packet.embedding = Object.values(
        packet.packet.embedding as any
      ) as number[];
      packet.packet.bEmbedding = Object.values(
        packet.packet.bEmbedding as any
      ) as number[];
    } else if (packet.packet.type === "inferenceRevealRejected") {
      if (
        packet.packet.rejectReason.type ===
        "computed_bembedding_fails_threshold"
      ) {
        packet.packet.rejectReason.computedBEmbedding = Object.values(
          packet.packet.rejectReason.computedBEmbedding as any
        ) as number[];
      }

      packet.packet.rejectReason.revealedBEmbedding = Object.values(
        packet.packet.rejectReason.revealedBEmbedding as any
      ) as number[];
    }
  }

  async getPacket(synthientId: string, signature: string) {
    return await this.db.packets.get({ synthientId, signature });
  }

  private verifyAndDedupeReceivedPacketQueue(
    queue: ReceivedPeerPacket[]
  ): ReceivedPeerPacket[] {
    const signatureCheckedPackets = queue.filter((packet) => {
      const validSignature = verifySignatureOnJSONObject(
        packet.synthientId,
        packet.signature,
        packet.packet
      );

      if (!validSignature) {
        logger.debug(
          `Invalid signature on packet, dropping packet from ${packet.synthientId}`,
          packet
        );
      }

      return validSignature;
    });

    const uniquePackets: { [key: string]: ReceivedPeerPacket } = {};

    signatureCheckedPackets.forEach((packet) => {
      const key = packet.synthientId + packet.signature;
      if (!uniquePackets[key]) {
        uniquePackets[key] = packet;
      }
    });

    return Object.values(uniquePackets);
  }

  processReceivedPacketQueue = debounce(
    async () => {
      const queueCopy = this.receivedPacketQueue;
      this.receivedPacketQueue = [];

      const dedupedQueue = this.verifyAndDedupeReceivedPacketQueue(queueCopy);

      const existingPackets = await this.db.packets
        .where("[synthientId+signature]")
        .anyOf(
          dedupedQueue.map((packet) => [packet.synthientId, packet.signature])
        )
        .toArray();

      const dedupedWithExisting = dedupedQueue.filter((packet) => {
        const packetExists = !existingPackets.some(
          (existingPacket) =>
            existingPacket.synthientId === packet.synthientId &&
            existingPacket.signature === packet.signature
        );

        // if (!packetExists) {
        //   logger.debug(
        //     "Packet already exists in the database, dropping",
        //     packet
        //   );
        // }

        return packetExists;
      });

      const fixedPackets = dedupedWithExisting.map((packet) => {
        this.fixEmbeddingArraysInPackets(packet);
        return packet;
      });

      try {
        await this.db.packets
          .bulkPut(fixedPackets)
          .catch(Dexie.BulkError, function (e) {
            // Explicitly catching the bulkAdd() operation makes those successful
            // additions commit despite that there were errors.
            logger.error(
              `${e.failures.length} packets were added successfully, but some others could not be. Check console for errors`,
              e
            );
          });
      } catch (err) {
        logger.error("Different error adding packets to the database", err);
      }

      const bootPacketsInQueue = !!fixedPackets.some(
        (packet) =>
          packet.packet.type === "peerStatusUpdate" &&
          packet.packet.status === "boot"
      );

      this.peerDB.processPackets(fixedPackets).then((newPeersSeen) => {
        if (newPeersSeen || bootPacketsInQueue) {
          this.transmitPeerList();
        }
      });

      fixedPackets.forEach((packet) => this.emitNewPacketEvents(packet));

      // Peerhearts are special and throttled
      const peerHearts = fixedPackets
        .filter((packet) => packet.packet.type === "peerHeart")
        .slice(0, PACKET_DB_SETTINGS.peerHeartLimit) as (ReceivedPeerPacket & {
        packet: PeerHeart;
      })[];

      peerHearts.forEach((packet) => this.emitPeerHeart(packet));
    },
    PACKET_DB_SETTINGS.receivePacketQueueDebounceMs,
    { trailing: true }
  );

  async transmitPeerList() {
    // Calculate if we should be the ones sending
    const lastTwelveHours = new Date(Date.now() - 12 * 60 * 60 * 1000);

    // TODO: These are magic constants for now, move them to settings later
    const peerList = await this.peerDB.getLastPeers(lastTwelveHours, 200);

    const commsProbability =
      PACKET_DB_SETTINGS.peerCommunicationCount / peerList.length;

    if (Math.random() < commsProbability) {
      const knownPeers: KnownPeers = {
        type: "knownPeers",
        peerList: peerList.map((peer) => ({
          synthientId: peer.synthientId,
          identities: peer.chainIds,
          lastSeen: peer.lastSeen && stringifyDateWithOffset(peer.lastSeen),
          seenOn: peer.seenOn,
        })),
        createdAt: stringifyDateWithOffset(new Date()),
      };

      logger.debug(
        `Transmitting peer list with ${Object.values(knownPeers).length}`,
        knownPeers
      );

      await this.transmitPacket(knownPeers);
    }
  }

  emitPeerHeart(heartPacket: ReceivedPeerPacket & { packet: PeerHeart }) {
    this.emit("peerHeart", heartPacket);
  }

  receivePacket(receivedPacket: ReceivedPeerPacket): void {
    logger.trace("Queued received packet: ", receivedPacket);

    this.receivedPacketQueue.push(receivedPacket);

    this.processReceivedPacketQueue();

    if (
      this.receivedPacketQueue.length >=
      PACKET_DB_SETTINGS.maxReceivedPacketQueueSize
    ) {
      this.processReceivedPacketQueue.flush();
    }
  }

  async printPackets(): Promise<void> {
    const packets = await this.db.packets.toArray();
  }

  async dropOldPackets(maxAgeMs: number): Promise<void> {
    const cutoffTime = new Date(Date.now() - maxAgeMs);

    // Won't drop our packets at any length of time because they don't have receivedTime set, this is intentional - for now
    await this.db.packets.where("receivedTime").below(cutoffTime).delete();

    logger.debug(`Dropped packets older than ${maxAgeMs}ms`);
  }

  async clearPackets(): Promise<void> {
    await this.db.packets.clear();
    logger.debug("Cleared all packets from the database.");
  }
}
