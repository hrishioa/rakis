import Dexie, { type DexieOptions } from "dexie";
import { ChainIdentity, Peer, SupportedP2PDeliveryNetwork } from "./entities";
import {
  KnownPeers,
  PeerConnectedChain,
  ReceivedPeerPacket,
} from "./packet-types";
import { createLogger, logStyles } from "../utils/logger";

const logger = createLogger("PeerDB", logStyles.databases.peerDB);

class PeerDatabase extends Dexie {
  peers!: Dexie.Table<Peer, string>;

  constructor(options: DexieOptions = {}) {
    super("PeerDB", options);
    this.version(2).stores({
      peers: "synthientId, lastSeen",
    });
  }
}

export class PeerDB {
  private db: PeerDatabase;

  constructor(dbOptions: DexieOptions = {}) {
    this.db = new PeerDatabase(dbOptions);
  }

  async getLastPeers(lastSeenAfter: Date, maxCount: number): Promise<Peer[]> {
    return this.db.peers
      .where("lastSeen")
      .aboveOrEqual(lastSeenAfter)
      .limit(maxCount)
      .toArray();
  }

  async getPeerCount(lastSeenAfter?: Date) {
    return lastSeenAfter
      ? this.db.peers.where("lastSeen").aboveOrEqual(lastSeenAfter).count()
      : this.db.peers.count();
  }

  async processPackets(packets: ReceivedPeerPacket[]): Promise<boolean> {
    const synthientIds = packets.map((packet) => packet.synthientId);

    const existingPeers = (await this.db.peers.bulkGet(synthientIds)).filter(
      (peer: Peer | undefined) => !!peer
    ) as Peer[];

    let newPeersSeen: boolean = false;

    const peers: Peer[] = Array.from(new Set(synthientIds)).map(
      (synthientId) => {
        const peerPackets = packets
          .filter((packet) => packet.synthientId === synthientId)
          .sort(
            (a, b) =>
              (b.receivedTime?.getTime() || 0) -
              (a.receivedTime?.getTime() || 0)
          );

        const existingPeer = existingPeers.find(
          (peer) => peer.synthientId === synthientId
        );

        if (!existingPeer) {
          newPeersSeen = true;
        }

        const updatedPeer: Peer = existingPeer || {
          synthientId,
          seenOn: [],
          lastSeen: peerPackets[0].receivedTime || new Date(),
          chainIds: [],
        };

        updatedPeer.seenOn = Array.from(
          new Set([
            ...updatedPeer.seenOn,
            ...(peerPackets
              .map((packet) => packet.deliveredThrough)
              .filter((dT) => !!dT) as SupportedP2PDeliveryNetwork[]),
          ])
        );

        // TODO: This is way too complicated I know but we're just
        // deduping the chainIds array in the end
        updatedPeer.chainIds = Object.values(
          [
            ...updatedPeer.chainIds,
            ...peerPackets
              .filter((packet) => packet.packet.type === "peerConnectedChain")
              .map((packet) => (packet.packet as PeerConnectedChain).identities)
              .flat(),
          ].reduce((acc, cur) => {
            acc[cur.chain + cur.address] = cur;
            return acc;
          }, {} as { [key: string]: ChainIdentity })
        );

        return updatedPeer;
      }
    );

    await this.db.peers.bulkPut(peers);

    const knownPeerPackets = packets.filter(
      (packet) => packet.packet.type === "knownPeers"
    ) as (ReceivedPeerPacket & { packet: KnownPeers })[];

    if (knownPeerPackets.length > 0) {
      this.loadKnownPeerPackets(knownPeerPackets);
    }

    console.log("New peers seen: ", newPeersSeen);

    return newPeersSeen;
  }

  async loadKnownPeerPackets(
    packets: (ReceivedPeerPacket & { packet: KnownPeers })[]
  ): Promise<void> {
    console.log("received known peer packets ", packets);

    const synthientIds = packets.flatMap((packet) =>
      packet.packet.peerList.map((peer) => peer.synthientId)
    );

    const existingPeers = (await this.db.peers.bulkGet(synthientIds)).filter(
      (peer: Peer | undefined) => !!peer
    ) as Peer[];

    const newPeers: { [synthientId: string]: Peer } = {};

    packets.forEach((packet) => {
      packet.packet.peerList.forEach((peer) => {
        const updatedPeer: Peer = existingPeers.find(
          (p) => p.synthientId === peer.synthientId
        ) ||
          newPeers[peer.synthientId] || {
            synthientId: peer.synthientId,
            seenOn: peer.seenOn,
            lastSeen: new Date(peer.lastSeen),
            chainIds: peer.identities,
          };

        updatedPeer.seenOn = Array.from(
          new Set([...updatedPeer.seenOn, ...peer.seenOn])
        );

        updatedPeer.chainIds = Object.values(
          [...updatedPeer.chainIds, ...(peer.identities || [])].reduce(
            (acc, cur) => {
              acc[cur.chain + cur.address] = cur;
              return acc;
            },
            {} as { [key: string]: ChainIdentity }
          )
        );

        updatedPeer.lastSeen =
          updatedPeer.lastSeen &&
          new Date(
            Math.max(
              updatedPeer.lastSeen.getTime(),
              new Date(peer.lastSeen).getTime()
            ) || new Date(peer.lastSeen)
          );

        newPeers[peer.synthientId] = updatedPeer;
      });
    });

    await this.db.peers.bulkPut(Object.values(newPeers));
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
