import Gun from "gun";
import type {
  GunHookMessagePut,
  GunMessagePut,
  IGunInstance,
  IGunOnEvent,
} from "gun";
import { ReceivedPeerPacket, TransmittedPeerPacket } from "../db/packet-types";
import { P2PNetworkInstance, PacketReceivedCallback } from "./p2pnetwork-types";
import { DeferredPromise } from "../../utils/deferredpromise";
import { stringifyDateWithOffset } from "../utils";

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

  constructor(synthientId: string, options: GunBootstrapOptions) {
    super(synthientId, options);
    this.gunTopic = options.gunTopic;

    this.gun = Gun({
      peers: options.gunPeers,
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

    console.log("Transmitting through gun: ", serializedPacket);

    return new Promise((resolve) => {
      this.gun
        .get(this.gunTopic)
        .put(serializedPacket, (ack: GunMessagePut) => {
          if ((ack as any).err) {
            console.error("Error sending gun message: ", (ack as any).err);
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

      console.log("Got packet ", data, " from gun");

      const packet: ReceivedPeerPacket = {
        ...data,
        receivedTime: new Date(),
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

  registerErrorHandler(errorHandler: (error: Error) => void): void {
    // Gun doesn't provide a direct way to handle errors
    // You can implement your own error handling mechanism if needed
    // TODO: Long term we want to shuttle the errors out so replace the console errors with a call to the error handler
  }

  gracefulShutdown(): void {
    // Gun doesn't provide a direct way to gracefully shut down
    // You can implement your own shutdown logic if needed
  }
}
