import { MultiClient, Wallet } from "nkn-sdk";
import { ReceivedPeerPacket, TransmittedPeerPacket } from "../db/packet-types";
import {
  P2PNetworkInstance,
  PacketReceivedCallback,
  RegisterErrorHandler,
} from "./p2pnetwork-types";
import { DeferredPromise } from "../../utils/deferredpromise";
import { NKN_CONFIG } from "../config";

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
  private errorHandler:
    | ((error: Error, restartRecommended: boolean) => void)
    | undefined;

  constructor(synthientId: string, options: NknBootstrapOptions) {
    super(synthientId, options);
    this.nknTopic = options.nknTopic;

    const wallet = new Wallet({ password: options.nknWalletPassword });

    this.nknClient = new MultiClient({
      identifier: synthientId,
      seed: wallet.getSeed(),
    });

    console.log(`NKN: NKN client created with id ${synthientId}`);

    this.nknClient.onMessage(({ src, payload }) => {
      console.log(`NKN: Received message from `, src, "payload", payload);
      const packet: ReceivedPeerPacket = JSON.parse(payload as string);
      packet.receivedTime = new Date();
      this.packetReceivedCallbacks.forEach((callback) => {
        callback(packet, { nknAddress: src });
      });
    });

    this.nknClient.onConnect(({ addr }) => {
      console.log(`NKN: Connected`);

      this.loadingPromise.resolve(true);
    });

    this.nknClient.onConnectFailed(() => {
      console.log("NKN: Connection failed");
      this.loadingPromise.resolve(false);

      if (this.errorHandler) {
        this.errorHandler(new Error("NKN: Connection failed"), true);
      }
    });

    wallet
      .subscribe(
        this.nknTopic,
        SUBSCRIPTION_DURATION_BLOCKS,
        this.synthientId,
        ""
      )
      .then((txnHash) => {
        console.log("NKN: Subscribed to events in tx ", txnHash);
        this.renewalIntervalId = setInterval(async () => {
          await wallet
            .subscribe(
              this.nknTopic,
              SUBSCRIPTION_DURATION_BLOCKS,
              this.synthientId,
              ""
            )
            .then((txnHash) => {
              console.log("NKN: Renewed subscription in tx ", txnHash);
            });
        }, SUBSCRIPTION_RENEWAL_INTERVAL_MS);
      });
  }

  async waitForReady(): Promise<boolean> {
    return this.loadingPromise.promise;
  }

  async broadcastPacket(packet: TransmittedPeerPacket): Promise<boolean> {
    if (this.nknClient) {
      console.log("NKN: Sending message", packet);
      try {
        await this.nknClient.publish(this.nknTopic, JSON.stringify(packet), {
          txPool: true,
        });
        return true;
      } catch (error) {
        console.error("NKN: Error sending message", error);
        this.transmissionErrorCount++;
        if (
          this.errorHandler &&
          this.transmissionErrorCount > NKN_CONFIG.maxSendErrorsBeforeRestart
        ) {
          this.errorHandler(error as Error, true);
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

  registerErrorHandler: RegisterErrorHandler = (errorHandler) => {
    this.errorHandler = errorHandler;
  };

  async gracefulShutdown() {
    if (this.renewalIntervalId) {
      clearInterval(this.renewalIntervalId);
    }

    await this.nknClient.close();
  }
}
