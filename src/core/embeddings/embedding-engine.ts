import {
  EmbeddingEngineLogEntry,
  EmbeddingModelName,
  EmbeddingResult,
  EmbeddingWorkerReceivedMessage,
  EmbeddingWorkerSentMessage,
} from "./types";
import { DeferredPromise } from "../utils/deferredpromise";

const embeddingEngineLog: EmbeddingEngineLogEntry[] = [];

let embeddingBatchCounter = 0;

let queuesRunning = 0;

const embeddingWorkers: Record<
  string,
  {
    worker: Worker;
    modelName: EmbeddingModelName;
    status: "loading" | "loaded" | "failed";
    busy: boolean;
    workerLoadedPromise: DeferredPromise<boolean>;
  }
> = {};

const embeddingJobQueue: {
  assignedWorkerId?: string;
  batchId: string;
  modelName: EmbeddingModelName;
  params: {
    texts: string[];
  };
  completionPromise: DeferredPromise<EmbeddingResult[] | false>;
}[] = [];

export function getEmbeddingEngineLogs(
  lastNPackets: number
): EmbeddingEngineLogEntry[] {
  return embeddingEngineLog.slice(-lastNPackets);
}

function logEngineEvent(entry: EmbeddingEngineLogEntry): number {
  if (!entry.at) entry.at = new Date();
  const logLength = embeddingEngineLog.length;

  console.log("Embedding engine event ", logLength, " - ", entry);

  embeddingEngineLog.push(entry);
  return logLength;
}

export function addEmbeddingWorker(
  modelName: EmbeddingModelName,
  workerId: string
) {
  if (embeddingWorkers[workerId]) {
    return;
  }

  console.log("Trying to create new embedding worker", modelName, workerId);

  const worker = new Worker(new URL("./embedding-worker", import.meta.url));

  worker.onmessage = (event: MessageEvent<EmbeddingWorkerSentMessage>) => {
    const message = event.data;

    switch (message.type) {
      case "workerLoaded":
        embeddingWorkers[workerId].status = "loaded";
        embeddingWorkers[workerId].busy = false;
        logEngineEvent({
          type: "embeddings_worker_loaded",
          modelName,
          workerId,
        });
        embeddingWorkers[workerId].workerLoadedPromise.resolve(true);
        break;
      case "workerLoadFailure":
        embeddingWorkers[workerId].status = "failed";
        logEngineEvent({
          type: "engine_loading_error",
          modelName,
          error: "Failed to load embedding worker",
          workerId,
        });
        embeddingWorkers[workerId].workerLoadedPromise.resolve(false);
        logEngineEvent({
          type: "embeddings_worker_unload",
          workerId,
        });
        delete embeddingWorkers[workerId];
        break;
      case "embeddingSuccess":
        const job = embeddingJobQueue.find(
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
        const failedJob = embeddingJobQueue.find(
          (job) => job.assignedWorkerId === workerId
        );
        if (failedJob) {
          failedJob.completionPromise.resolve(false);
        }
        break;
      case "workerBusyEmbedding":
        embeddingWorkers[workerId].busy = true;
        break;
      case "workerIdle":
        embeddingWorkers[workerId].busy = false;
        runJobFromQueue();
        break;
    }
  };

  worker.postMessage({
    type: "loadWorker",
    modelName,
    workerId,
  } as EmbeddingWorkerReceivedMessage);

  embeddingWorkers[workerId] = {
    busy: true,
    worker,
    modelName,
    status: "loading",
    workerLoadedPromise: new DeferredPromise<boolean>(),
  };
}

export function deleteEmbeddingWorker(workerId: string) {
  if (embeddingWorkers[workerId]) {
    embeddingWorkers[workerId].worker.terminate();
    delete embeddingWorkers[workerId];

    logEngineEvent({
      type: "embeddings_worker_unload",
      workerId,
    });
  }
}

export async function embedText(
  texts: string[],
  modelName: EmbeddingModelName
) {
  const completionPromise = new DeferredPromise<EmbeddingResult[] | false>();

  embeddingJobQueue.push({
    batchId: `${embeddingBatchCounter++}`,
    modelName,
    params: {
      texts,
    },
    completionPromise,
  });

  if (queuesRunning < Object.keys(embeddingWorkers).length) runJobFromQueue();

  return completionPromise.promise;
}

async function runJobFromQueue() {
  try {
    queuesRunning++;

    console.log(
      "Trying to run a job from the queue, queue length is",
      embeddingJobQueue.length,
      "jobs, with ",
      queuesRunning,
      " queues running"
    );

    const unassignedJobs = embeddingJobQueue.filter(
      (job) => !job.assignedWorkerId
    );

    if (unassignedJobs.length === 0) {
      console.log("No jobs left, queue is going to sleep");
      queuesRunning--;
      return;
    }

    // I know this is not really atomic but this is meant to be a Proof of Concept goddamit
    const selectedJob = unassignedJobs.shift()!;

    const matchingWorkerIds = Object.keys(embeddingWorkers).filter(
      (workerId) =>
        embeddingWorkers[workerId].modelName === selectedJob.modelName
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
          embeddingWorkers[workerId] &&
          embeddingWorkers[workerId].modelName === selectedJob.modelName &&
          embeddingWorkers[workerId].status === "loaded" &&
          !embeddingWorkers[workerId].busy
      );

      if (freeWorkers.length === 0) {
        unassignedJobs.unshift(selectedJob);

        console.log("No free workers available, wait to be called on idle");
        queuesRunning--;
        return;
      }

      const selectedWorkerId =
        freeWorkers[Math.floor(Math.random() * freeWorkers.length)];

      selectedJob.assignedWorkerId = selectedWorkerId;

      embeddingJobQueue.push(selectedJob);

      selectedJob.params.texts.forEach((text, index) => {
        logEngineEvent({
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
        embeddingWorkers[selectedWorkerId].worker.postMessage({
          type: "embedText",
          texts: selectedJob.params.texts,
          batchId: selectedJob.batchId,
        } as EmbeddingWorkerReceivedMessage);

        const results = await selectedJob.completionPromise.promise;

        if (results) {
          results.forEach((result, index) => {
            logEngineEvent({
              type: "engine_embedding_success",
              bEmbeddingHash: result.bEmbeddingHash,
              batchId: selectedJob.batchId,
              workerId: selectedWorkerId,
            });
          });
        } else {
          selectedJob.params.texts.forEach((text, index) => {
            logEngineEvent({
              type: "engine_embedding_error",
              error: "Failed to embed text, returned false",
              batchId: selectedJob.batchId,
              workerId: selectedWorkerId,
            });
          });
        }

        queuesRunning--;
        return results;
      } catch (error) {
        selectedJob.params.texts.forEach((text, index) => {
          logEngineEvent({
            type: "engine_embedding_error",
            error,
            batchId: selectedJob.batchId,
            workerId: selectedWorkerId,
          });
        });

        selectedJob.completionPromise.resolve(false);

        queuesRunning--;
      }
    }
  } catch (err) {
    console.error("Error running job from queue", err);
    logEngineEvent({
      type: "engine_embedding_error",
      error: err,
      batchId: "unassigned",
      workerId: "unassigned",
    });
    queuesRunning--;
  }
}
