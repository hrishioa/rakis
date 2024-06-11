import {
  EmbeddingEngineLogEntry,
  EmbeddingModelName,
  EmbeddingResult,
  EmbeddingWorkerReceivedMessage,
  EmbeddingWorkerSentMessage,
} from "./types";
import { DeferredPromise } from "../utils/deferredpromise";
import EventEmitter from "eventemitter3";
import { generateRandomString } from "../utils/utils";
import { createLogger, logStyles } from "../utils/logger";
const logger = createLogger("Embedding Engine", logStyles.embeddingEngine.main);

type EmbeddingEngineEvents = {
  workerFree: (data: { modelName: string; workerId: string }) => void;
};

export class EmbeddingEngine extends EventEmitter<EmbeddingEngineEvents> {
  private embeddingEngineLog: EmbeddingEngineLogEntry[] = [];
  private embeddingBatchCounter = 0;
  private queuesRunning = 0;
  public embeddingWorkers: Record<
    string,
    {
      worker: Worker;
      modelName: EmbeddingModelName;
      status: "loading" | "loaded" | "failed";
      busy: boolean;
      workerLoadedPromise: DeferredPromise<boolean>;
    }
  > = {};
  private embeddingJobQueue: {
    assignedWorkerId?: string;
    batchId: string;
    modelName: EmbeddingModelName;
    params: {
      texts: string[];
    };
    completionPromise: DeferredPromise<EmbeddingResult[] | false>;
  }[] = [];

  public getEmbeddingEngineLogs(
    lastNPackets: number
  ): EmbeddingEngineLogEntry[] {
    return this.embeddingEngineLog.slice(-lastNPackets);
  }

  public getAvailableModels(): EmbeddingModelName[] {
    return Array.from(
      new Set(
        Object.keys(this.embeddingWorkers).map(
          (workerId) => this.embeddingWorkers[workerId].modelName
        )
      )
    );
  }

  private logEngineEvent(entry: EmbeddingEngineLogEntry): number {
    if (!entry.at) entry.at = new Date();
    const logLength = this.embeddingEngineLog.length;

    logger.debug("Embedding engine event ", logLength, " - ", entry);

    this.embeddingEngineLog.push(entry);
    return logLength;
  }

  public async scaleEmbeddingWorkers(
    modelName: EmbeddingModelName,
    count: number
  ) {
    const numberOfExistingWorkers = Object.values(this.embeddingWorkers).filter(
      (worker) => worker.modelName === modelName
    ).length;

    if (numberOfExistingWorkers === count) return;

    if (numberOfExistingWorkers < count) {
      logger.debug(
        "Scaling up number of embedding workers for ",
        modelName,
        " to ",
        count
      );
      for (let i = 0; i < count - numberOfExistingWorkers; i++) {
        const workerId = `embedding-${modelName}-${generateRandomString()}`;
        this.addEmbeddingWorker(modelName, workerId);
      }
    } else {
      logger.debug(
        "Scaling down number of embedding workers for ",
        modelName,
        " to ",
        count
      );

      const workerIdsByLoad = Object.keys(this.embeddingWorkers).sort((a, b) =>
        this.embeddingWorkers[a].busy === this.embeddingWorkers[b].busy
          ? 0
          : this.embeddingWorkers[a].busy
          ? -1
          : 1
      );

      const workerIdsToScaleDown = workerIdsByLoad.slice(
        0,
        numberOfExistingWorkers - count
      );

      for (const workerId of workerIdsToScaleDown) {
        this.deleteEmbeddingWorker(workerId);
      }
    }
  }

  public addEmbeddingWorker(modelName: EmbeddingModelName, workerId: string) {
    if (this.embeddingWorkers[workerId]) {
      return;
    }

    logger.debug("Trying to create new embedding worker", modelName, workerId);

    const worker = new Worker(new URL("./embedding-worker", import.meta.url));

    worker.onmessage = (event: MessageEvent<EmbeddingWorkerSentMessage>) => {
      const message = event.data;

      switch (message.type) {
        case "workerLoaded":
          this.embeddingWorkers[workerId].status = "loaded";
          this.embeddingWorkers[workerId].busy = false;
          this.logEngineEvent({
            type: "embeddings_worker_loaded",
            modelName,
            workerId,
          });
          this.embeddingWorkers[workerId].workerLoadedPromise.resolve(true);
          this.emit("workerFree", { modelName, workerId });
          break;
        case "workerLoadFailure":
          this.embeddingWorkers[workerId].status = "failed";
          this.logEngineEvent({
            type: "engine_loading_error",
            modelName,
            error: "Failed to load embedding worker",
            workerId,
          });
          this.embeddingWorkers[workerId].workerLoadedPromise.resolve(false);
          this.logEngineEvent({
            type: "embeddings_worker_unload",
            workerId,
          });
          delete this.embeddingWorkers[workerId];
          break;
        case "embeddingSuccess":
          const job = this.embeddingJobQueue.find(
            (job) => job.batchId === message.batchId
          );
          if (job) {
            job.completionPromise.resolve(message.results);
          } else {
            logger.error(
              "EMBEDDING ENGINE ERROR: SHOUDLNT HAPPEN, couldn't find job to resolve"
            );
          }
          this.emit("workerFree", { modelName, workerId });
          break;
        case "embeddingFailure":
          const failedJob = this.embeddingJobQueue.find(
            (job) => job.assignedWorkerId === workerId
          );
          if (failedJob) {
            failedJob.completionPromise.resolve(false);
          }
          this.emit("workerFree", { modelName, workerId });
          break;
        case "workerBusyEmbedding":
          this.embeddingWorkers[workerId].busy = true;
          break;
        case "workerIdle":
          this.embeddingWorkers[workerId].busy = false;
          this.runJobFromQueue();
          break;
      }
    };

    worker.postMessage({
      type: "loadWorker",
      modelName,
      workerId,
    } as EmbeddingWorkerReceivedMessage);

    this.embeddingWorkers[workerId] = {
      busy: true,
      worker,
      modelName,
      status: "loading",
      workerLoadedPromise: new DeferredPromise<boolean>(),
    };
  }

  public deleteEmbeddingWorker(workerId: string) {
    if (this.embeddingWorkers[workerId]) {
      this.embeddingWorkers[workerId].worker.terminate();
      delete this.embeddingWorkers[workerId];

      this.logEngineEvent({
        type: "embeddings_worker_unload",
        workerId,
      });
    }
  }

  public async embedText(texts: string[], modelName: EmbeddingModelName) {
    const completionPromise = new DeferredPromise<EmbeddingResult[] | false>();

    this.embeddingJobQueue.push({
      batchId: `${this.embeddingBatchCounter++}`,
      modelName,
      params: {
        texts,
      },
      completionPromise,
    });

    if (this.queuesRunning < Object.keys(this.embeddingWorkers).length)
      this.runJobFromQueue();

    return completionPromise.promise;
  }

  private async runJobFromQueue() {
    try {
      this.queuesRunning++;

      logger.debug(
        "Trying to run a job from the queue, queue length is",
        this.embeddingJobQueue.length,
        "jobs, with ",
        this.queuesRunning,
        " queues running"
      );

      const unassignedJobs = this.embeddingJobQueue.filter(
        (job) => !job.assignedWorkerId
      );

      if (unassignedJobs.length === 0) {
        logger.debug("No jobs left, queue is going to sleep");
        this.queuesRunning--;
        return;
      }

      const selectedJob = unassignedJobs.shift()!;

      const matchingWorkerIds = Object.keys(this.embeddingWorkers).filter(
        (workerId) =>
          this.embeddingWorkers[workerId].modelName === selectedJob.modelName
      );

      if (matchingWorkerIds.length === 0) {
        logger.error(
          `No workers loaded with embedding model ${selectedJob.modelName}, ignoring job`
        );

        selectedJob.completionPromise.resolve(false);
      } else {
        logger.debug(
          `${matchingWorkerIds.length} workers available for embedding ${selectedJob.params.texts}`
        );

        const freeWorkers = matchingWorkerIds.filter(
          (workerId) =>
            this.embeddingWorkers[workerId] &&
            this.embeddingWorkers[workerId].modelName ===
              selectedJob.modelName &&
            this.embeddingWorkers[workerId].status === "loaded" &&
            !this.embeddingWorkers[workerId].busy
        );

        if (freeWorkers.length === 0) {
          unassignedJobs.unshift(selectedJob);

          logger.debug("No free workers available, wait to be called on idle");
          this.queuesRunning--;
          return;
        }

        const selectedWorkerId =
          freeWorkers[Math.floor(Math.random() * freeWorkers.length)];

        selectedJob.assignedWorkerId = selectedWorkerId;

        this.embeddingJobQueue.push(selectedJob);

        selectedJob.params.texts.forEach((text, index) => {
          this.logEngineEvent({
            type: "engine_embedding_start",
            text,
            batchId: selectedJob.batchId,
            workerId: selectedWorkerId,
          });
        });

        logger.debug(
          `Embedding ${selectedJob.batchId}`,
          selectedJob.params.texts.length,
          " texts with ",
          selectedJob.modelName,
          " on worker ",
          selectedWorkerId
        );

        try {
          this.embeddingWorkers[selectedWorkerId].worker.postMessage({
            type: "embedText",
            texts: selectedJob.params.texts,
            batchId: selectedJob.batchId,
          } as EmbeddingWorkerReceivedMessage);

          const results = await selectedJob.completionPromise.promise;

          if (results) {
            results.forEach((result, index) => {
              this.logEngineEvent({
                type: "engine_embedding_success",
                bEmbeddingHash: result.bEmbeddingHash,
                batchId: selectedJob.batchId,
                workerId: selectedWorkerId,
              });
            });
          } else {
            selectedJob.params.texts.forEach((text, index) => {
              this.logEngineEvent({
                type: "engine_embedding_error",
                error: "Failed to embed text, returned false",
                batchId: selectedJob.batchId,
                workerId: selectedWorkerId,
              });
            });
          }

          this.queuesRunning--;
          return results;
        } catch (error) {
          selectedJob.params.texts.forEach((text, index) => {
            this.logEngineEvent({
              type: "engine_embedding_error",
              error,
              batchId: selectedJob.batchId,
              workerId: selectedWorkerId,
            });
          });

          selectedJob.completionPromise.resolve(false);

          this.queuesRunning--;
        }
      }
    } catch (err) {
      logger.error("Error running job from queue", err);
      this.logEngineEvent({
        type: "engine_embedding_error",
        error: err,
        batchId: "unassigned",
        workerId: "unassigned",
      });
      this.queuesRunning--;
    }
  }
}
