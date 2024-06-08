import { MultiClient, Wallet } from "nkn-sdk";
import { ReceivedPeerPacket, TransmittedPeerPacket } from "../db/packet-types";
import {
  ErrorHandler,
  P2PNetworkInstance,
  PacketReceivedCallback,
} from "./p2pnetwork-types";
import { DeferredPromise } from "../utils/deferredpromise";
import { P2P_CONFIG } from "./p2p-config";
import { createLogger, logStyles } from "../utils/logger";

const logger = createLogger("P2P: NKN", logStyles.p2pNetworks.nkn);

export type NknBootstrapOptions = {
  nknTopic: string;
  nknWalletPassword: string;
};

export type NknAvailablePeerInfo = {
  nknAddress: string;
};

const BLOCK_TIME_SECONDS = 20;
const SUBSCRIPTION_DURATION_BLOCKS = 1000;
const SUBSCRIPTION_RENEWAL_INTERVAL_MS =
  (SUBSCRIPTION_DURATION_BLOCKS - 10) * BLOCK_TIME_SECONDS * 1000;

export class NknP2PNetworkInstance extends P2PNetworkInstance<
  NknBootstrapOptions,
  NknAvailablePeerInfo
> {
  private nknClient: MultiClient;
  private nknTopic: string;
  private loadingPromise = new DeferredPromise<boolean>();
  private renewalIntervalId: NodeJS.Timeout | undefined;
  private transmissionErrorCount: number = 0;
  private packetReceivedCallbacks: PacketReceivedCallback<NknAvailablePeerInfo>[] =
    [];
  private errorHandlers: ErrorHandler[] = [];

  constructor(synthientId: string, options: NknBootstrapOptions) {
    super(synthientId, options);
    this.nknTopic = options.nknTopic;

    const wallet = new Wallet({ password: options.nknWalletPassword });

    this.nknClient = new MultiClient({
      identifier: synthientId,
      seed: wallet.getSeed(),
    });

    logger.debug(`NKN client created with id ${synthientId}`);

    this.nknClient.onMessage(({ src, payload }) => {
      logger.debug(`Received message from `, src, "payload", payload);
      const packet: ReceivedPeerPacket = JSON.parse(payload as string);
      packet.receivedTime = new Date();
      packet.deliveredThrough = "nkn";
      this.packetReceivedCallbacks.forEach((callback) => {
        callback(packet, { nknAddress: src });
      });
    });

    this.nknClient.onConnect(({ addr }) => {
      logger.debug(`Connected`);

      this.loadingPromise.resolve(true);
    });

    this.nknClient.onConnectFailed(() => {
      logger.debug("Connection failed");
      this.loadingPromise.resolve(false);

      this.errorHandlers.forEach((handler) => {
        handler(new Error("Connection failed"), true);
      });
    });

    wallet
      .subscribe(
        this.nknTopic,
        SUBSCRIPTION_DURATION_BLOCKS,
        this.synthientId,
        ""
      )
      .then((txnHash) => {
        logger.debug("Subscribed to events in tx ", txnHash);
        this.renewalIntervalId = setInterval(async () => {
          await wallet
            .subscribe(
              this.nknTopic,
              SUBSCRIPTION_DURATION_BLOCKS,
              this.synthientId,
              ""
            )
            .then((txnHash) => {
              logger.debug("Renewed subscription in tx ", txnHash);
            });
        }, SUBSCRIPTION_RENEWAL_INTERVAL_MS);
      });
  }

  async waitForReady(): Promise<boolean> {
    return this.loadingPromise.promise;
  }

  async broadcastPacket(packet: TransmittedPeerPacket): Promise<boolean> {
    if (this.nknClient) {
      logger.debug("Sending message", packet);
      try {
        await this.nknClient.publish(this.nknTopic, JSON.stringify(packet), {
          txPool: true,
        });
        return true;
      } catch (error) {
        logger.error("Error sending message", error);
        this.transmissionErrorCount++;
        if (
          this.transmissionErrorCount >
          P2P_CONFIG.NKN.maxSendErrorsBeforeRestart
        ) {
          this.errorHandlers.forEach((handler) =>
            handler(error as Error, true)
          );
        }
        return false;
      }
    }
    return false;
  }

  listenForPacket(
    callback: PacketReceivedCallback<NknAvailablePeerInfo>
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
    if (this.renewalIntervalId) {
      clearInterval(this.renewalIntervalId);
    }

    await this.nknClient.close();
  }
}
