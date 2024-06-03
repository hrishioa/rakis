import Dexie from "dexie";
import * as ed from "@noble/ed25519";
import type {
  PeerPacket,
  ReceivedPeerPacket,
  TransmittedPeerPacket,
} from "./packet-types";
import type { ClientInfo } from "../identity";
import { sha512 } from "@noble/hashes/sha512";
ed.etc.sha512Sync = (...m) => sha512(ed.etc.concatBytes(...m));

type SendPacketOverP2PFunc = (packet: TransmittedPeerPacket) => Promise<void>;

// Define the database schema
class PacketDatabase extends Dexie {
  packets!: Dexie.Table<ReceivedPeerPacket, string>;

  constructor() {
    super("PacketDatabase");
    this.version(1).stores({
      packets:
        "++id, synthientId, [synthientId+signature], packet.type, packet.requestId, packet.inferenceId, receivedTime",
    });
  }
}

export class PacketDB {
  private db: PacketDatabase;
  private clientInfo: ClientInfo;
  private sendPacketOverP2P: SendPacketOverP2PFunc;

  constructor(
    clientInfo: ClientInfo,
    sendPacketOverP2P: SendPacketOverP2PFunc
  ) {
    this.db = new PacketDatabase();
    this.clientInfo = clientInfo;
    this.sendPacketOverP2P = sendPacketOverP2P;
  }

  // Function to send a packet over the P2P network (replace with your implementation)
  // private async sendPacketOverP2P(
  //   packet: TransmittedPeerPacket
  // ): Promise<void> {
  //   console.log("Sending packet over P2P network:", packet);
  //   // Your implementation to send the packet over the P2P network goes here
  // }

  async transmitPacket(packet: PeerPacket): Promise<void> {
    console.log("Transmitting packet:", packet);

    // Create the transmitted packet
    const transmittedPacket: TransmittedPeerPacket = {
      synthientId: this.clientInfo.synthientId,
      peerTime: new Date(),
      signature: "", // Will be set later
      packet,
    };

    // Compute the signature
    const message = JSON.stringify(transmittedPacket);
    const signature = await ed.sign(message, this.clientInfo.synthientPrivKey);
    transmittedPacket.signature = ed.etc.bytesToHex(signature);

    // Save the packet in the database
    await this.db.packets.add({
      ...transmittedPacket,
      receivedTime: undefined, // Set as undefined since it's our own packet
    });

    // Send the packet over the P2P network
    await this.sendPacketOverP2P(transmittedPacket);
  }

  async receivePacket(receivedPacket: ReceivedPeerPacket): Promise<void> {
    console.log("Received packet:", receivedPacket);

    // Check if the packet already exists in the database
    const existingPacket = await this.db.packets.get({
      synthientId: receivedPacket.synthientId,
      signature: receivedPacket.signature,
    });

    if (existingPacket) {
      console.log("Packet already exists in the database. Dropping.");
      return;
    }

    // Validate the signature
    const message = JSON.stringify(receivedPacket);
    const signatureValid = await ed.verify(
      ed.etc.hexToBytes(receivedPacket.signature),
      message,
      receivedPacket.synthientId
    );

    if (!signatureValid) {
      console.log("Invalid signature. Dropping packet.");
      return;
    }

    // Add the packet to the database
    await this.db.packets.add({
      ...receivedPacket,
      receivedTime: new Date(), // Set the receivedTime to the current timestamp
    });
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
