import Dexie, { DexieOptions } from "dexie";
import * as ed from "@noble/ed25519";
import type {
  PeerPacket,
  ReceivedPeerPacket,
  TransmittedPeerPacket,
} from "./packet-types";
import type { ClientInfo } from "../identity";
import { sha512 } from "@noble/hashes/sha512";
import { signJSONObject, verifySignatureOnJSONObject } from "../simple-crypto";
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

export class PacketDB {
  private db: PacketDatabase;
  private clientInfo: ClientInfo;
  private sendPacketOverP2P: SendPacketOverP2PFunc;

  constructor(
    clientInfo: ClientInfo,
    sendPacketOverP2P: SendPacketOverP2PFunc,
    dbOptions: DexieOptions = {}
  ) {
    this.db = new PacketDatabase(dbOptions);
    this.clientInfo = clientInfo;
    this.sendPacketOverP2P = sendPacketOverP2P;
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

    console.log("PacketDB: Transmitting packet:", transmittedPacket);
    console.log(
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
    console.log("PacketDB: Received packet:", receivedPacket);

    // Check if the packet already exists in the database
    const existingPacket = await this.db.packets.get({
      synthientId: receivedPacket.synthientId,
      signature: receivedPacket.signature,
    });

    if (existingPacket) {
      console.log("Packet already exists in the database. Dropping.");
      return false;
    }

    try {
      // Validate the signature
      const signatureValid = verifySignatureOnJSONObject(
        receivedPacket.synthientId,
        receivedPacket.signature,
        receivedPacket.packet
      );

      if (!signatureValid) {
        console.log("Invalid signature. Dropping packet.");
        console.log(
          "PacketDB: Signature ",
          receivedPacket.signature,
          " is invalid for packet ",
          JSON.stringify(receivedPacket.packet)
        );
        return false;
      }
    } catch (err) {
      console.error(
        "Error verifying signature for packet ",
        receivedPacket,
        err
      );
      return false;
    }

    console.log("Actually adding packet!");
    // Add the packet to the database
    await this.db.packets.add({
      ...receivedPacket,
      // receivedTime: new Date(), // Set the receivedTime to the current timestamp
    });

    return true;
  }

  async printPackets(): Promise<void> {
    const packets = await this.db.packets.toArray();
    console.log("Packets in the database:", packets);
  }

  async dropOldPackets(maxAgeMs: number): Promise<void> {
    const cutoffTime = new Date(Date.now() - maxAgeMs);

    // Won't drop our packets at any length of time because they don't have receivedTime set, this is intentional - for now

    await this.db.packets.where("receivedTime").below(cutoffTime).delete();

    console.log(`Dropped packets older than ${maxAgeMs}ms`);
  }

  async clearPackets(): Promise<void> {
    await this.db.packets.clear();
    console.log("Cleared all packets from the database.");
  }
}
