import Dexie, { type DexieOptions } from "dexie";
import { Peer } from "./entities";
import { ReceivedPeerPacket } from "./packet-types";

class PeerDatabase extends Dexie {
  peers!: Dexie.Table<Peer, string>;

  constructor(options: DexieOptions = {}) {
    super("PeerDB", options);
    this.version(1).stores({
      peers: "synthientId",
    });
  }
}

export class PeerDB {
  private db: PeerDatabase;

  constructor(dbOptions: DexieOptions = {}) {
    this.db = new PeerDatabase(dbOptions);
  }

  async processPacket(packet: ReceivedPeerPacket) {
    const { synthientId } = packet;

    // Check if the peer already exists in the database
    let peer = await this.getPeer(synthientId);

    if (peer) {
      // Update the existing peer
      // Update the seenOn array if the delivery network is not already present
      if (!peer.seenOn.includes(packet.deliveredThrough!)) {
        peer.seenOn.push(packet.deliveredThrough!);
      }

      // Update the lastSeen timestamp
      peer.lastSeen = packet.receivedTime || new Date();

      // Update the deviceInfo if provided in the packet
      if (packet.packet.type === "peerInfo") {
        peer.deviceInfo = packet.packet.deviceInfo;
      }

      // Update the chainIds array if new identities are provided in the packet
      if (packet.packet.type === "peerConnectedChain") {
        const newChainIds = packet.packet.identities;

        // Merge the new chainIds with the existing ones
        peer.chainIds = peer.chainIds.filter(
          (existingChainId) =>
            !newChainIds.some(
              (newChainId) =>
                newChainId.chain === existingChainId.chain &&
                newChainId.address === existingChainId.address
            )
        );
        peer.chainIds.push(...newChainIds);
      }
    } else {
      // Create a new peer
      peer = {
        synthientId,
        seenOn: [packet.deliveredThrough!],
        lastSeen: packet.receivedTime || new Date(),
        chainIds: [],
      };

      // Add deviceInfo if provided in the packet
      if (packet.packet.type === "peerInfo") {
        peer.deviceInfo = packet.packet.deviceInfo;
      }

      // Add chainIds if provided in the packet
      if (packet.packet.type === "peerConnectedChain") {
        peer.chainIds = packet.packet.identities;
      }
    }

    // Update or add the peer using the put method
    await this.db.peers.put(peer);
  }

  async getPeer(synthientId: string): Promise<Peer | undefined> {
    return this.db.peers.get(synthientId);
  }

  async getAllPeers(): Promise<Peer[]> {
    return this.db.peers.toArray();
  }

  async deletePeer(synthientId: string): Promise<void> {
    await this.db.peers.delete(synthientId);
  }
}
