import Dexie, { type DexieOptions } from "dexie";
import { Peer, SupportedChains } from "./entities";
import {
  InferenceRequest,
  ReceivedPeerPacket,
  UnprocessedInferenceRequest,
} from "./packet-types";
import { sha256 } from "@noble/hashes/sha256";
import * as ed from "@noble/ed25519";
import { LLMModelName } from "../../llm/types";

class InferenceDatabase extends Dexie {
  inferenceRequests!: Dexie.Table<InferenceRequest, string>;

  constructor(options: DexieOptions = {}) {
    super("InferenceDB", options);
    this.version(1).stores({
      inferenceRequests:
        "requestId, fromChain, endingAt, payload.acceptedModels",
    });
  }
}

export type InferenceSelector = {
  requestId?: string;
  fromChains?: SupportedChains[];
  endingBefore?: Date;
  models?: LLMModelName[];
  active?: boolean; // Is this inference currently active, i.e are we before its endtime
};

export class InferenceDB {
  private db: InferenceDatabase;
  public activeInferenceRequests: InferenceRequest[] = [];
  private cleanupTimeout: NodeJS.Timeout | null = null;
  private inferenceSubscriptions: {
    filter: InferenceSelector;
    callback: (inferences: InferenceRequest[]) => void;
  }[] = [];

  constructor(dbOptions: DexieOptions = {}) {
    this.db = new InferenceDatabase(dbOptions);
  }

  private refreshCleanupTimeout() {
    if (this.cleanupTimeout) {
      clearTimeout(this.cleanupTimeout);
      this.cleanupTimeout = null;
    }

    const now = new Date();
    let shortestTimeout = Infinity;

    for (const inference of this.activeInferenceRequests) {
      const timeRemaining = inference.endingAt.getTime() - now.getTime();
      if (timeRemaining < shortestTimeout) {
        shortestTimeout = timeRemaining;
      }
    }

    if (shortestTimeout !== Infinity) {
      this.cleanupTimeout = setTimeout(() => {
        this.cleanupExpiredInferences();
      }, shortestTimeout);
    }
  }

  private async cleanupExpiredInferences() {
    const now = new Date();

    this.activeInferenceRequests = this.activeInferenceRequests.filter(
      (inference) => !(inference.endingAt <= now)
    );

    console.log(
      "Active inferences after cleanup",
      this.activeInferenceRequests.length
    );

    if (this.activeInferenceRequests.length > 0) {
      this.refreshCleanupTimeout();
    }
  }

  async subscribeToInferences(
    selector: InferenceSelector,
    callback: (inferences: InferenceRequest[]) => void
  ): Promise<() => void> {
    const subscription = { filter: selector, callback };
    this.inferenceSubscriptions.push(subscription);

    // Return a function to remove the subscription
    return () => {
      const index = this.inferenceSubscriptions.indexOf(subscription);
      if (index !== -1) {
        this.inferenceSubscriptions.splice(index, 1);
      }
    };
  }

  private async notifySubscriptions(newInferences: InferenceRequest[]) {
    for (const subscription of this.inferenceSubscriptions) {
      const matchingInferences = newInferences.filter((inference) => {
        return (
          (!subscription.filter.requestId ||
            inference.requestId === subscription.filter.requestId) &&
          (!subscription.filter.fromChains ||
            subscription.filter.fromChains.includes(
              inference.payload.fromChain
            )) &&
          (!subscription.filter.endingBefore ||
            inference.endingAt < subscription.filter.endingBefore) &&
          (!subscription.filter.models ||
            subscription.filter.models.some((model) =>
              inference.payload.acceptedModels.includes(model)
            )) &&
          (subscription.filter.active === undefined ||
            (subscription.filter.active && inference.endingAt > new Date()) ||
            (!subscription.filter.active && inference.endingAt <= new Date()))
        );
      });

      if (matchingInferences.length > 0) {
        subscription.callback(matchingInferences);
      }
    }
  }

  async saveInferenceRequest(
    request: UnprocessedInferenceRequest
  ): Promise<void> {
    // Calculate a hash of the object values to use as the requestId
    const objectValues = Object.values(request.payload).join("");
    const requestId = ed.etc.bytesToHex(sha256(objectValues));
    request.requestId = requestId;

    // Check if the request already exists in the database
    const existingRequest = await this.db.inferenceRequests.get(
      request.requestId
    );
    if (existingRequest) {
      console.log("Inference request already exists. Skipping save.");
      return;
    }

    // Calculate endingAt date from the securityFrame of the request
    const endingAt = new Date(
      request.payload.createdAt.getTime() +
        request.payload.securityFrame.maxTimeMs
    );
    request.endingAt = endingAt;

    const processedRequest: InferenceRequest = {
      ...request,
      endingAt,
      requestId,
    };

    // Save the request to the database
    await this.db.inferenceRequests.put(processedRequest);

    // Update the activeInferenceRequests array
    if (endingAt > new Date()) {
      this.activeInferenceRequests.push(processedRequest);

      console.log(
        "Active inferences after save",
        this.activeInferenceRequests.length
      );

      this.refreshCleanupTimeout();
    }

    // Notify subscribers of the new inference request
    await this.notifySubscriptions([processedRequest]);
  }
}
