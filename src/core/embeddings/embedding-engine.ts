import {
  EmbeddingEngineLogEntry,
  EmbeddingModelName,
  EmbeddingResult,
  EmbeddingWorkerReceivedMessage,
  EmbeddingWorkerSentMessage,
} from "./types";
import { DeferredPromise } from "../utils/deferredpromise";

export class EmbeddingEngine {
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

  private logEngineEvent(entry: EmbeddingEngineLogEntry): number {
    if (!entry.at) entry.at = new Date();
    const logLength = this.embeddingEngineLog.length;

    console.log("Embedding engine event ", logLength, " - ", entry);

    this.embeddingEngineLog.push(entry);
    return logLength;
  }

  public addEmbeddingWorker(modelName: EmbeddingModelName, workerId: string) {
    if (this.embeddingWorkers[workerId]) {
      return;
    }

    console.log("Trying to create new embedding worker", modelName, workerId);

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
            console.error(
              "EMBEDDING ENGINE ERROR: SHOUDLNT HAPPEN, couldn't find job to resolve"
            );
          }
          break;
        case "embeddingFailure":
          const failedJob = this.embeddingJobQueue.find(
            (job) => job.assignedWorkerId === workerId
          );
          if (failedJob) {
            failedJob.completionPromise.resolve(false);
          }
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

      console.log(
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
        console.log("No jobs left, queue is going to sleep");
        this.queuesRunning--;
        return;
      }

      const selectedJob = unassignedJobs.shift()!;

      const matchingWorkerIds = Object.keys(this.embeddingWorkers).filter(
        (workerId) =>
          this.embeddingWorkers[workerId].modelName === selectedJob.modelName
      );

      if (matchingWorkerIds.length === 0) {
        console.error(
          `No workers loaded with embedding model ${selectedJob.modelName}, ignoring job`
        );

        selectedJob.completionPromise.resolve(false);
      } else {
        console.log(
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

          console.log("No free workers available, wait to be called on idle");
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

        console.log(
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
      console.error("Error running job from queue", err);
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
