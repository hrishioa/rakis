import Dexie, { type DexieOptions } from "dexie";
import { ChainIdentity, Peer, SupportedP2PDeliveryNetwork } from "./entities";
import {
  KnownPeers,
  PeerConnectedChain,
  ReceivedPeerPacket,
} from "./packet-types";
import { createLogger, logStyles } from "../utils/logger";
import { verifyEthChainSignature } from "../utils/simple-crypto";

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

  private async updateChainIdentities(
    existingChainIds: ChainIdentity[],
    synthientId: string,
    identitiesToVerify: ChainIdentity[]
  ) {
    // TODO: I know this is a side-effect but I don't have the time to actually work through the memory cost of making this copy
    const chainIds = existingChainIds;

    await Promise.all(
      identitiesToVerify.map(async (identity) => {
        if (
          chainIds.find(
            (id) =>
              id.chain === identity.chain && id.address === identity.address
          )
        ) {
          return;
        }

        if (
          await verifyEthChainSignature(
            synthientId,
            identity.synthientIdSignature as `0x${string}`
          )
        ) {
          chainIds.push(identity);
        } else {
          logger.error(
            `Could not verify identity for ${synthientId} on chain ${identity.chain} with address ${identity.address}`
          );
        }
      })
    );

    return chainIds;
  }

  async getNetworkTotalTokens() {
    return (await this.db.peers.toArray()).reduce(
      (acc, cur) => acc + cur.totalTokens,
      0
    );
  }

  async getPeerStats(lastSeen: Date): Promise<{
    totalTokens: number;
    totalPeers: number;
    totalWorkers: number;
  }> {
    const totalPeers = await this.db.peers
      .where("lastSeen")
      .above(lastSeen)
      .count();
    const totalTokens = (
      await this.db.peers.where("lastSeen").above(lastSeen).toArray()
    ).reduce(
      (acc, cur) => acc + ((!isNaN(cur.totalTokens) && cur.totalTokens) || 0),
      0
    );
    const totalWorkers = (
      await this.db.peers.where("lastSeen").above(lastSeen).toArray()
    ).reduce(
      (acc, cur) => acc + ((!isNaN(cur.totalWorkers) && cur.totalWorkers) || 0),
      0
    );

    return { totalTokens, totalPeers, totalWorkers };
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

    const peers: Peer[] = await Promise.all(
      Array.from(new Set(synthientIds)).map(async (synthientId) => {
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

        const newIdentities = (
          peerPackets.filter(
            (packet) => packet.packet.type === "peerConnectedChain"
          ) as (ReceivedPeerPacket & { packet: PeerConnectedChain })[]
        ).flatMap((packet) => packet.packet.identities);

        const tokenCounts = peerPackets
          .map((packet) =>
            packet.packet.type === "peerStatusUpdate" &&
            (packet.packet.status === "completed_inference" ||
              packet.packet.status === "boot")
              ? packet.packet.totalTokens
              : 0
          )
          .concat([existingPeer?.totalTokens || 0])
          .filter((count) => !isNaN(count) && count > 0);

        const totalWorkers = peerPackets
          .map((packet) =>
            packet.packet.type === "peerStatusUpdate" &&
            packet.packet.status === "loaded_worker"
              ? packet.packet.totalWorkers
              : 0
          )
          .concat([existingPeer?.totalWorkers || 0])
          .filter((count) => !isNaN(count) && count > 0);

        let totalTokens = tokenCounts.length > 0 ? Math.max(...tokenCounts) : 0;

        const updatedPeer: Peer = existingPeer || {
          synthientId,
          seenOn: [],
          totalTokens: 0,
          totalWorkers: 0,
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
        updatedPeer.chainIds = await this.updateChainIdentities(
          updatedPeer.chainIds,
          synthientId,
          newIdentities
        );

        updatedPeer.totalTokens = Math.max(
          totalTokens,
          updatedPeer.totalTokens || 0
        );

        updatedPeer.totalWorkers = Math.max(
          totalWorkers.length > 0 ? Math.max(...totalWorkers) : 0,
          updatedPeer.totalWorkers || 0
        );

        return updatedPeer;
      })
    );

    await this.db.peers.bulkPut(peers);

    const knownPeerPackets = packets.filter(
      (packet) => packet.packet.type === "knownPeers"
    ) as (ReceivedPeerPacket & { packet: KnownPeers })[];

    if (knownPeerPackets.length > 0) {
      this.loadKnownPeerPackets(knownPeerPackets);
    }

    return newPeersSeen;
  }

  async loadKnownPeerPackets(
    packets: (ReceivedPeerPacket & { packet: KnownPeers })[]
  ): Promise<void> {
    const synthientIds = packets.flatMap((packet) =>
      packet.packet.peerList.map((peer) => peer.synthientId)
    );

    const existingPeers = (await this.db.peers.bulkGet(synthientIds)).filter(
      (peer: Peer | undefined) => !!peer
    ) as Peer[];

    const newPeers: { [synthientId: string]: Peer } = {};

    // Flatten the peer lists and only keep the latest ones.
    const flattenedIncomingPeerList: {
      [synthientId: string]: {
        peer: Peer;
        latestUpdate: Date;
      };
    } = {};

    packets.forEach((packet) => {
      // TODO: Maybe we should do a more comprehensive merge to keep as many chainidentities as we can?
      packet.packet.peerList.forEach((peer) => {
        if (
          flattenedIncomingPeerList[peer.synthientId] &&
          flattenedIncomingPeerList[peer.synthientId].latestUpdate >=
            new Date(packet.packet.createdAt)
        ) {
          return;
        }

        flattenedIncomingPeerList[peer.synthientId] = {
          peer: {
            totalTokens: peer.totalTokens,
            synthientId: peer.synthientId,
            seenOn: peer.seenOn,
            totalWorkers: peer.totalWorkers,
            lastSeen: new Date(peer.lastSeen),
            chainIds: peer.identities || [],
          },
          latestUpdate: new Date(packet.packet.createdAt),
        };
      });
    });

    await Promise.all(
      Object.values(flattenedIncomingPeerList).map(async ({ peer }) => {
        const existingPeer = existingPeers.find(
          (p) => p.synthientId === peer.synthientId
        );

        const updatedPeer: Peer = existingPeer ||
          newPeers[peer.synthientId] || {
            synthientId: peer.synthientId,
            seenOn: peer.seenOn,
            lastSeen: new Date(peer.lastSeen),
            chainIds: [],
          };

        updatedPeer.seenOn = Array.from(
          new Set([...updatedPeer.seenOn, ...peer.seenOn])
        );

        updatedPeer.chainIds = await this.updateChainIdentities(
          updatedPeer.chainIds,
          peer.synthientId,
          peer.chainIds
        );

        updatedPeer.lastSeen =
          updatedPeer.lastSeen &&
          new Date(
            Math.max(
              updatedPeer.lastSeen.getTime(),
              new Date(peer.lastSeen).getTime()
            ) || new Date(peer.lastSeen)
          );

        logger.debug(
          `UpdatedPeer totalTokens: ${peer.totalTokens} ${updatedPeer.totalTokens}`
        );

        const totalTokenList = [
          peer.totalTokens,
          updatedPeer.totalTokens,
        ].filter((tT) => !isNaN(tT) && tT > 0);

        updatedPeer.totalTokens =
          totalTokenList.length > 0 ? Math.max(...totalTokenList) : 0;

        updatedPeer.totalWorkers = Math.max(
          peer.totalWorkers,
          updatedPeer.totalWorkers
        );

        newPeers[peer.synthientId] = updatedPeer;
      })
    );

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
