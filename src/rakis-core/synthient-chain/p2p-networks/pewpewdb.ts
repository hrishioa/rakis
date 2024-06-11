import Gun from "gun";
import type {
  GunHookMessagePut,
  GunMessagePut,
  IGunInstance,
  IGunOnEvent,
} from "gun";
import { ReceivedPeerPacket, TransmittedPeerPacket } from "../db/packet-types";
import {
  ErrorHandler,
  P2PNetworkInstance,
  PacketReceivedCallback,
} from "./p2pnetwork-types";
import { DeferredPromise } from "../utils/deferredpromise";
import { createLogger, logStyles } from "../utils/logger";

const logger = createLogger("P2P: PewPewDB", logStyles.p2pNetworks.pewpewdb);

export type GunBootstrapOptions = {
  gunPeers: string[];
  gunTopic: string;
  startupDelayMs: number;
};

export type GunAvailablePeerInfo = {};

type GunInternalTransmissionPacket = Omit<TransmittedPeerPacket, "packet"> & {
  packet: string;
};

export class GunP2PNetworkInstance extends P2PNetworkInstance<
  GunBootstrapOptions,
  GunAvailablePeerInfo
> {
  private gun: IGunInstance<any>;
  private gunTopic: string;
  private packetHandlerIds: number[] = [];
  private packetHandlerIdCouinter = 0;
  private loadingPromise = new DeferredPromise<void>();
  private errorHandlers: ErrorHandler[] = [];

  constructor(synthientId: string, options: GunBootstrapOptions) {
    super(synthientId, options);
    this.gunTopic = options.gunTopic;

    this.gun = Gun({
      peers: options.gunPeers,
      localStorage: false,
    });

    setTimeout(() => {
      this.loadingPromise.resolve();
    }, options.startupDelayMs);
  }

  async waitForReady(): Promise<boolean> {
    await this.loadingPromise.promise;
    return true;
  }

  async broadcastPacket(packet: TransmittedPeerPacket): Promise<boolean> {
    const serializedPacket: GunInternalTransmissionPacket = {
      ...packet,
      // TODO: Properly type this for both sides
      packet: JSON.stringify(packet.packet),
    };

    logger.debug("Transmitting through gun: ", serializedPacket);

    return new Promise((resolve) => {
      this.gun
        .get(this.gunTopic)
        .put(serializedPacket, (ack: GunMessagePut) => {
          if ((ack as any).err) {
            logger.error("Error sending gun message: ", (ack as any).err);
            return resolve(false);
          }
          return resolve(true);
        });
    });
  }

  listenForPacket(callback: PacketReceivedCallback<GunAvailablePeerInfo>) {
    const packetHandlerId = this.packetHandlerIdCouinter++;
    this.packetHandlerIds.push(packetHandlerId);

    const handler = (
      data: GunInternalTransmissionPacket,
      _key: string,
      _msg: GunHookMessagePut,
      event: IGunOnEvent
    ) => {
      if (!this.packetHandlerIds.includes(packetHandlerId)) {
        event.off();
        return;
      }

      logger.debug("Got packet ", data, " from gun");

      const packet: ReceivedPeerPacket = {
        ...data,
        receivedTime: new Date(),
        deliveredThrough: "gun",
        packet: JSON.parse(data.packet),
      };

      callback(packet, {});
    };

    this.gun.get(this.gunTopic).on(handler);

    return () => {
      this.packetHandlerIds = this.packetHandlerIds.filter(
        (id) => id !== packetHandlerId
      );
    };
  }

  // Gun doesn't provide a direct way to handle errors
  // You can implement your own error handling mechanism if needed
  // TODO: Long term we want to shuttle the errors out so replace the console errors with a call to the error handler
  registerErrorHandler(errorHandler: ErrorHandler) {
    this.errorHandlers.push(errorHandler);
    return () => {
      this.errorHandlers = this.errorHandlers.filter(
        (handler) => handler !== errorHandler
      );
    };
  }

  gracefulShutdown(): void {
    // Gun doesn't provide a direct way to gracefully shut down
    // You can implement your own shutdown logic if needed
  }
}
