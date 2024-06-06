import { joinRoom as joinTorrentRoom } from "trystero/torrent";
import { joinRoom as joinNostrRoom } from "trystero/nostr";
import { ReceivedPeerPacket, TransmittedPeerPacket } from "../db/packet-types";
import {
  ErrorHandler,
  P2PNetworkInstance,
  PacketReceivedCallback,
} from "./p2pnetwork-types";
import { DeferredPromise } from "../../utils/deferredpromise";
import { Room } from "trystero";
import { P2P_CONFIG } from "./p2p-config";
import { createLogger, logStyles } from "../utils/logger";

export type TrysteroBootstrapOptions = {
  trysteroAppId: string;
  trysteroType: "torrent" | "nostr";
  trysteroTopic: string;
  relayRedundancy: number;
  rtcConfig: any;
};

export type TrysteroAvailablePeerInfo = {
  peerId: string;
};

export class TrysteroP2PNetworkInstance extends P2PNetworkInstance<
  TrysteroBootstrapOptions,
  TrysteroAvailablePeerInfo
> {
  private trysteroRoom: Room;
  private loadingPromise = new DeferredPromise<boolean>();
  private transmissionErrorCount: number = 0;
  private packetReceivedCallbacks: PacketReceivedCallback<TrysteroAvailablePeerInfo>[] =
    [];
  private errorHandlers: ErrorHandler[] = [];
  private logger: ReturnType<typeof createLogger>;

  constructor(synthientId: string, options: TrysteroBootstrapOptions) {
    super(synthientId, options);
    this.logger = createLogger(
      `P2P: ${options.trysteroType} (trystero)`,
      logStyles.p2pNetworks[options.trysteroType]
    );
    try {
      this.trysteroRoom =
        this.options.trysteroType === "nostr"
          ? joinNostrRoom(
              {
                appId: this.options.trysteroAppId,
                relayRedundancy: this.options.relayRedundancy,
                rtcConfig: this.options.rtcConfig,
              },
              this.options.trysteroTopic
            )
          : joinTorrentRoom(
              {
                appId: this.options.trysteroAppId,
                relayRedundancy: this.options.relayRedundancy,
                rtcConfig: this.options.rtcConfig,
              },
              this.options.trysteroTopic
            );

      this.logger.debug("Trystero: Trystero client created", this.trysteroRoom);

      // this.trysteroRoom.onPeerJoin((peerId: string) => {
      //   this.logger.debug("Trystero: Peer joined", peerId);

      //   this.loadingPromise.resolve(true);
      // });

      const [, getMessages] = this.trysteroRoom.makeAction(
        this.options.trysteroTopic
      );

      getMessages((data: any, peerId: string) => {
        const packet: ReceivedPeerPacket = {
          ...data,
          receivedTime: new Date(),
          deliveredThrough: this.options.trysteroType,
        };
        this.packetReceivedCallbacks.forEach((callback) => {
          callback(packet, { peerId });
        });
      });

      this.loadingPromise.resolve(true); // Best we can do 🤷
    } catch (error) {
      this.logger.error("Trystero: Error setting up Trystero", error);
      this.loadingPromise.resolve(false);
      this.errorHandlers.forEach((handler) => handler(error as Error, true));

      throw error;
    }
  }

  async waitForReady(): Promise<boolean> {
    return this.loadingPromise.promise;
  }

  async broadcastPacket(packet: TransmittedPeerPacket): Promise<boolean> {
    if (this.trysteroRoom) {
      try {
        const [sendMessage] = this.trysteroRoom.makeAction(
          this.options.trysteroTopic
        );
        sendMessage(packet);
        return true;
      } catch (error) {
        this.transmissionErrorCount++;

        this.logger.error("Trystero: Error sending message", error);
        this.errorHandlers.forEach((handler) =>
          handler(
            error as Error,
            this.transmissionErrorCount >
              P2P_CONFIG.TRYSTERO.maxTransmissionErrorsBeforeRestart
          )
        );
        return false;
      }
    }
    return false;
  }

  listenForPacket(
    callback: PacketReceivedCallback<TrysteroAvailablePeerInfo>
  ): () => void {
    this.packetReceivedCallbacks.push(callback);
    return () => {
      this.packetReceivedCallbacks = this.packetReceivedCallbacks.filter(
        (cb) => cb !== callback
      );
    };
  }

  registerErrorHandler(errorHandler: ErrorHandler) {
    this.errorHandlers.push(errorHandler);
    return () => {
      this.errorHandlers = this.errorHandlers.filter(
        (handler) => handler !== errorHandler
      );
    };
  }

  async gracefulShutdown() {
    this.trysteroRoom.leave();
  }
}
