import Dexie, { DexieOptions } from "dexie";
import * as ed from "@noble/ed25519";
import {
  InferenceCommit,
  InferenceReveal,
  InferenceRevealRequest,
  P2PInferenceRequestPacket,
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
import { InferenceDB } from "./inferencedb";

const logger = createLogger("PacketDB", logStyles.databases.packetDB);

ed.etc.sha512Sync = (...m) => sha512(ed.etc.concatBytes(...m));

type SendPacketOverP2PFunc = (packet: TransmittedPeerPacket) => Promise<void>;

// TODO: Consider keeping createdAt time as a separate date field on the outside, as a Date object in the db for better indexing

export type PacketSelector = Partial<{
  synthientId: string;
  signature: string;
  types: string[];
  inferenceId: string;
  receivedTimeAfter: Date;
  receivedTimeBefore: Date;
  requestId: string;
}>;

export type PacketSubscriber = (packets: ReceivedPeerPacket) => void;

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

export type PacketDBEvents = {
  newP2PInferenceRequest: (packet: P2PInferenceRequestPacket) => void;
  newInferenceCommit: (
    packet: Omit<ReceivedPeerPacket, "packet"> & { packet: InferenceCommit }
  ) => void;
  newInferenceRevealRequest: (
    packet: Omit<ReceivedPeerPacket, "packet"> & {
      packet: InferenceRevealRequest;
    }
  ) => void;
  newInferenceRevealed: (
    packet: Omit<ReceivedPeerPacket, "packet"> & {
      packet: InferenceReveal;
    }
  ) => void;
};

export class PacketDB extends EventEmitter<PacketDBEvents> {
  private db: PacketDatabase;
  public peerDB: PeerDB;

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

  async emitNewPacketEvents(packet: ReceivedPeerPacket) {
    if (packet.packet.type === "p2pInferenceRequest") {
      this.emit(
        "newP2PInferenceRequest",
        packet.packet as P2PInferenceRequestPacket
      );
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

    logger.debug("Transmitting packet:", transmittedPacket);
    logger.debug(
      "Signature:",
      transmittedPacket.signature,
      "Packet:",
      JSON.stringify(packet)
    );

    // Send the packet over the P2P network
    await this.sendPacketOverP2P(transmittedPacket);
  }

  // Expensive, primarily for testing, if you're calling this otherwise please rethink your life choices
  async getAllPackets() {
    return await this.db.packets.toArray();
  }

  async getPacket(synthientId: string, signature: string) {
    return await this.db.packets.get({ synthientId, signature });
  }

  async receivePacket(receivedPacket: ReceivedPeerPacket): Promise<boolean> {
    logger.debug("Received packet:", receivedPacket);

    try {
      // Validate the signature
      const signatureValid = verifySignatureOnJSONObject(
        receivedPacket.synthientId,
        receivedPacket.signature,
        receivedPacket.packet
      );

      if (!signatureValid) {
        logger.debug("Invalid signature. Dropping packet.");
        logger.debug(
          "Signature ",
          receivedPacket.signature,
          " is invalid for packet ",
          JSON.stringify(receivedPacket.packet)
        );
        return false;
      }
    } catch (err) {
      logger.error(
        "Error verifying signature for packet ",
        receivedPacket,
        err
      );
      return false;
    }

    // Check if the packet already exists in the database
    const existingPacket = await this.db.packets.get({
      synthientId: receivedPacket.synthientId,
      signature: receivedPacket.signature,
    });

    if (existingPacket) {
      logger.debug("Packet already exists in the database. Dropping.");
      return false;
    }

    logger.debug("Actually adding packet!");
    // Add the packet to the database
    try {
      await this.db.packets.add({
        ...receivedPacket,
        // receivedTime: new Date(), // Set the receivedTime to the current timestamp
      });
    } catch (err) {
      logger.error("Error adding packet to the database", err);
      return false;
    }

    if (receivedPacket.receivedTime || new Date())
      this.peerDB.processPacket(receivedPacket);

    this.emitNewPacketEvents(receivedPacket);

    return true;
  }

  async printPackets(): Promise<void> {
    const packets = await this.db.packets.toArray();
    logger.debug("Packets in the database:", packets);
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
