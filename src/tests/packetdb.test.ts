import {
  PeerPacket,
  ReceivedPeerPacket,
  TransmittedPeerPacket,
} from "../core/synthient-chain/db/packet-types";
import * as ed from "@noble/ed25519";
import {
  ClientInfo,
  createNewEmptyIdentity,
} from "../core/synthient-chain/identity";
import { PacketDB } from "../core/synthient-chain/db/packetdb";

import { indexedDB, IDBKeyRange } from "fake-indexeddb";
import { signJSONObject } from "../core/synthient-chain/simple-crypto";

// Mock implementation of sendPacketOverP2P
const sendPacketOverP2PMock = jest.fn();

// Test client information
const clientInfo1: ClientInfo = createNewEmptyIdentity();

const clientInfo2: ClientInfo = createNewEmptyIdentity();

describe("PacketDB", () => {
  let packetDB: PacketDB;

  beforeEach(() => {
    packetDB = new PacketDB(clientInfo1, sendPacketOverP2PMock, {
      indexedDB: indexedDB,
      IDBKeyRange: IDBKeyRange,
    });
    sendPacketOverP2PMock.mockClear();
  });

  afterEach(async () => {
    await packetDB.clearPackets();
  });

  it("should transmit a valid packet", async () => {
    const packet: PeerPacket = {
      createdAt: new Date(),
      type: "peerStatusUpdate",
      status: "idle",
    };

    await packetDB.transmitPacket(packet);
    expect(sendPacketOverP2PMock).toHaveBeenCalledTimes(1);

    const transmittedPacket = sendPacketOverP2PMock.mock
      .calls[0][0] as TransmittedPeerPacket;
    expect(transmittedPacket.synthientId).toBe(clientInfo1.synthientId);
    expect(transmittedPacket.packet).toEqual(packet);

    const savedPacket = await packetDB.getPacket(
      clientInfo1.synthientId,
      transmittedPacket.signature
    );

    expect(savedPacket).toEqual(transmittedPacket);
  });

  it("should receive and save a valid packet", async () => {
    const packet: PeerPacket = {
      createdAt: new Date(),
      type: "peerStatusUpdate",
      status: "idle",
    };

    const transmittedPacket: TransmittedPeerPacket = {
      synthientId: clientInfo2.synthientId,
      signature: "",
      packet,
    };

    transmittedPacket.signature = signJSONObject(
      clientInfo2.synthientPrivKey,
      packet
    );

    const receivedPacket: ReceivedPeerPacket = {
      ...transmittedPacket,
    };

    await packetDB.receivePacket(receivedPacket);
    const savedPacket = await packetDB.getPacket(
      clientInfo2.synthientId,
      transmittedPacket.signature
    );
    expect(savedPacket).toEqual(expect.objectContaining(receivedPacket));
  });

  it("should reject a packet with an invalid signature", async () => {
    const packet: PeerPacket = {
      type: "peerStatusUpdate",
      createdAt: new Date(),
      status: "idle",
    };

    const invalidPacket: ReceivedPeerPacket = {
      synthientId: clientInfo2.synthientId,
      signature: "invalid_signature",
      packet,
      receivedTime: new Date(),
    };

    await packetDB.receivePacket(invalidPacket);
    const savedPacket = await packetDB.getPacket(
      clientInfo2.synthientId,
      invalidPacket.signature
    );
    expect(savedPacket).toBeUndefined();
  });

  it("should drop old packets", async () => {
    const packet: PeerPacket = {
      createdAt: new Date(),
      type: "peerStatusUpdate",
      status: "idle",
    };

    const transmittedPacket: TransmittedPeerPacket = {
      synthientId: clientInfo2.synthientId,
      signature: "",
      packet,
    };

    transmittedPacket.signature = signJSONObject(
      clientInfo2.synthientPrivKey,
      packet
    );

    const packet2: PeerPacket = {
      createdAt: new Date(),
      type: "peerStatusUpdate",
      status: "idle",
    };

    const transmittedPacket2: TransmittedPeerPacket = {
      synthientId: clientInfo2.synthientId,
      signature: "",
      packet: packet2,
    };

    transmittedPacket2.signature = signJSONObject(
      clientInfo2.synthientPrivKey,
      packet2
    );

    const oldReceivedPacket: ReceivedPeerPacket = {
      ...transmittedPacket,
      receivedTime: new Date(Date.now() - 1000 * 60 * 60), // 1 hour old
    };

    await packetDB.receivePacket(oldReceivedPacket);

    const recentReceivedPacket: ReceivedPeerPacket = {
      ...transmittedPacket2,
      receivedTime: new Date(), // Recent packet
    };

    await packetDB.receivePacket(recentReceivedPacket);

    await packetDB.dropOldPackets(1000 * 60 * 30); // Drop packets older than 30 minutes

    const oldPacket = await packetDB.getPacket(
      clientInfo2.synthientId,
      oldReceivedPacket.signature
    );

    expect(oldPacket).toBeUndefined();

    const recentPacket = await packetDB.getPacket(
      clientInfo2.synthientId,
      recentReceivedPacket.signature
    );
    expect(recentPacket).toEqual(recentReceivedPacket);
  });

  it("should clear all packets", async () => {
    const packet: PeerPacket = {
      type: "peerStatusUpdate",
      createdAt: new Date(),
      status: "idle",
    };

    await packetDB.transmitPacket(packet);
    await packetDB.clearPackets();

    const packets = await packetDB.getAllPackets();
    expect(packets).toHaveLength(0);
  });
});
