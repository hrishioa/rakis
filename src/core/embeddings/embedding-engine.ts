import { createWorkerFactory } from "@shopify/react-web-worker";
import {
  EmbeddingEngineLogEntry,
  EmbeddingModelName,
  EmbeddingResult,
} from "./types";
import { DeferredPromise } from "../utils/deferredpromise";

const createEmbeddingWorker = createWorkerFactory(
  () => import("./embedding-worker")
);

let queueActive = false,
  maxQueueRuns = 40;

const embeddingEngineLog: EmbeddingEngineLogEntry[] = [];

let embeddingBatchCounter = 0;

const embeddingWorkers: Record<
  string,
  {
    worker: ReturnType<typeof createEmbeddingWorker>;
    modelName: EmbeddingModelName;
  }
> = {};

const embeddingJobQueue: {
  assignedWorkerId?: string;
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

export async function addEmbeddingWorker(
  modelName: EmbeddingModelName,
  workerId: string
) {
  if (!embeddingWorkers[workerId]) {
    logEngineEvent({
      type: "embeddings_worker_loading",
      modelName,
      workerId,
    });

    embeddingWorkers[workerId] = {
      modelName,
      worker: createEmbeddingWorker(),
    };

    const success = await embeddingWorkers[workerId].worker.loadEmbeddingWorker(
      modelName
    );

    if (success) {
      logEngineEvent({
        type: "embeddings_worker_loaded",
        modelName,
        workerId,
      });
    } else {
      logEngineEvent({
        type: "engine_loading_error",
        modelName,
        error: "Failed to load embedding worker",
        workerId,
      });

      delete embeddingWorkers[workerId];
    }
  }
}

export function deleteEmbeddingWorker(workerId: string) {
  if (embeddingWorkers[workerId]) {
    delete embeddingWorkers[workerId];

    logEngineEvent({
      type: "embeddings_worker_unload",
      workerId,
    });
  }
}

export async function getWorkerStatuses() {
  return await Promise.all(
    Object.keys(embeddingWorkers).map(async (workerId) => ({
      workerId,
      status: await embeddingWorkers[workerId].worker.getWorkerStatus(),
    }))
  );
}

export async function embedText(
  texts: string[],
  modelName: EmbeddingModelName
) {
  const completionPromise = new DeferredPromise<EmbeddingResult[] | false>();

  embeddingJobQueue.push({
    modelName,
    params: {
      texts,
    },
    completionPromise,
  });

  if (!queueActive) runJobFromQueue();

  return completionPromise.promise;
}

async function runJobFromQueue() {
  if (maxQueueRuns-- <= 0) return;

  try {
    queueActive = true;

    console.log(
      "Trying to run a job from the queue, queue length is",
      embeddingJobQueue.length,
      "jobs"
    );

    const unassignedJobs = embeddingJobQueue.filter(
      (job) => !job.assignedWorkerId
    );

    if (unassignedJobs.length === 0) {
      console.log("No jobs left, queue is going to sleep");
      queueActive = false;
      return;
    }

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

      const workerStatuses = await getWorkerStatuses();

      console.log("Got statuses - ", workerStatuses);

      const freeWorkers = workerStatuses.filter(
        ({ workerId, status }) =>
          embeddingWorkers[workerId] &&
          embeddingWorkers[workerId].modelName === selectedJob.modelName &&
          status.modelLoaded &&
          !status.busyEmbedding
      );

      if (freeWorkers.length === 0) {
        unassignedJobs.unshift(selectedJob);

        console.log("No free workers available, waiting for one");

        await Promise.all(
          matchingWorkerIds.map(
            async (workerId) =>
              await embeddingWorkers[workerId].worker.waitForCompletion()
          )
        );

        return runJobFromQueue();
      }

      const selectedWorkerId =
        freeWorkers[Math.floor(Math.random() * freeWorkers.length)].workerId;

      selectedJob.assignedWorkerId = selectedWorkerId;

      const batchId = embeddingBatchCounter++;

      selectedJob.params.texts.forEach((text, index) => {
        logEngineEvent({
          type: "engine_embedding_start",
          text,
          batchId: `${batchId}-${index}`,
          workerId: selectedWorkerId,
        });
      });

      console.log(
        "Embedding ",
        selectedJob.params.texts.length,
        " texts with ",
        selectedJob.modelName,
        " on worker ",
        selectedWorkerId
      );

      try {
        const results = await embeddingWorkers[
          selectedWorkerId
        ].worker.embedText(selectedJob.params.texts, selectedJob.modelName);

        if (results) {
          results.forEach((result, index) => {
            logEngineEvent({
              type: "engine_embedding_success",
              bEmbeddingHash: result.bEmbeddingHash,
              batchId: `${batchId}-${index}`,
              workerId: selectedWorkerId,
            });
          });
        } else {
          selectedJob.params.texts.forEach((text, index) => {
            logEngineEvent({
              type: "engine_embedding_error",
              error: "Failed to embed text, returned false",
              batchId: `${batchId}-${index}`,
              workerId: selectedWorkerId,
            });
          });
        }

        selectedJob.completionPromise.resolve(results);
      } catch (error) {
        selectedJob.params.texts.forEach((text, index) => {
          logEngineEvent({
            type: "engine_embedding_error",
            error,
            batchId: `${batchId}-${index}`,
            workerId: selectedWorkerId,
          });
        });

        selectedJob.completionPromise.resolve(false);
      }
    }

    return runJobFromQueue();
  } catch (err) {
    console.error("Error running job from queue", err);
    logEngineEvent({
      type: "engine_embedding_error",
      error: err,
      batchId: "unassigned",
      workerId: "unassigned",
    });
    queueActive = false;
  }
}
