import { createWorkerFactory } from "@shopify/react-web-worker";
import { EmbeddingModelName, EmbeddingResult } from "./types";
import { DeferredPromise } from "../utils/deferredpromise";

const createEmbeddingWorker = createWorkerFactory(
  () => import("./embedding-worker")
);

let queueActive = false,
  maxQueueRuns = 40;

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

export async function addEmbeddingWorker(
  modelName: EmbeddingModelName,
  workerId: string
) {
  if (!embeddingWorkers[workerId]) {
    const newWorker = createEmbeddingWorker();

    const success = await newWorker.loadEmbeddingWorker(modelName);

    if (success)
      embeddingWorkers[workerId] = {
        worker: newWorker,
        modelName,
      };
  }
}

export function deleteEmbeddingWorker(workerId: string) {
  if (embeddingWorkers[workerId]) {
    delete embeddingWorkers[workerId];
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
        // TODO: For now a different type of model's job can hold up other jobs, we should consider parallel queues or some kind of more complex requeuing if we go down the multiple embedding models route, for now this is fine

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

      console.log(
        "Embedding ",
        selectedJob.params.texts.length,
        " texts with ",
        selectedJob.modelName,
        " on worker ",
        selectedWorkerId
      );

      const results = await embeddingWorkers[selectedWorkerId].worker.embedText(
        selectedJob.params.texts,
        selectedJob.modelName
      );

      selectedJob.completionPromise.resolve(results);
    }

    return runJobFromQueue();
  } catch (err) {
    console.error("Error running job from queue", err);
    queueActive = false;
  }
}
