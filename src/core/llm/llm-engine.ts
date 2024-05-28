import { DeferredPromise } from "../../utils/deferredpromise";
import * as webllm from "@mlc-ai/web-llm";
import {
  availableModels,
  InferencePacket,
  InferenceParams,
  LLMEngineLogEntry,
  LLMWorker,
} from "./types";

const llmWorkers: Record<string, LLMWorker> = {};

const engineLog: LLMEngineLogEntry[] = [];

let inferenceCounter: number = 0;

function logEngineEvent(entry: LLMEngineLogEntry): number {
  if (!entry.at) entry.at = new Date();
  const logLength = engineLog.length;

  console.log("Engine event ", logLength, " - ", entry);

  engineLog.push(entry);
  return logLength;
}

function updateStreamingLogResult(
  packet: InferencePacket,
  logEntryIndex: number
) {
  if (engineLog[logEntryIndex].type === "engine_inference_streaming_result") {
    if (packet.type === "token") {
      engineLog[logEntryIndex].result += packet.token;
      engineLog[logEntryIndex].tokenCount++;
    } else if (packet.type === "fullMessage") {
      engineLog[logEntryIndex].result = packet.message;
      engineLog[logEntryIndex].completed = true;
    } else if (packet.type === "tokenCount") {
      engineLog[logEntryIndex].tokenCount = packet.tokenCount;
    }
  }
}

export async function unloadWorker(workerId: string) {
  if (llmWorkers[workerId]) {
    llmWorkers[workerId].llmEngine?.unload();
    delete llmWorkers[workerId];
    logEngineEvent({
      type: "engine_unload",
      workerId,
    });
  }
}

export async function loadWorker(
  modelName: (typeof availableModels)[number],
  workerId: string
) {
  llmWorkers[workerId] ??= {
    modelName,
  };

  if (llmWorkers[workerId].modelLoadingPromise) {
    console.log(
      `Tried to create worker ${workerId}, but creation is already done or in progress`
    );
    return await llmWorkers[workerId]!.modelLoadingPromise!.promise;
  }

  llmWorkers[workerId].modelLoadingPromise = new DeferredPromise<
    boolean | string
  >();

  try {
    logEngineEvent({
      type: "engine_loading",
      modelName,
      workerId,
    });

    llmWorkers[workerId].llmEngine = await webllm.CreateWebWorkerEngine(
      new Worker(new URL("./mlc-worker.ts", import.meta.url), {
        type: "module",
      }),
      modelName,
      {
        initProgressCallback: (report: webllm.InitProgressReport) => {
          console.log(
            `Worker ${workerId}: Loading ${modelName} progress - `,
            report
          );
          if (report.progress === 1) {
            logEngineEvent({
              type: "engine_loaded",
              modelName,
              workerId,
            });
            llmWorkers[workerId].modelLoadingPromise?.resolve(workerId);
          }
        },
      }
    );
  } catch (err) {
    logEngineEvent({
      type: "engine_loading_error",
      modelName,
      workerId,
      error: err,
    });
    console.error(`Worker ${workerId}: Error loading ${modelName}`, err);
    llmWorkers[workerId].modelLoadingPromise?.reject(err);
  }

  return await llmWorkers[workerId]!.modelLoadingPromise!.promise;
}

function getMatchingWorkers(
  params: InferenceParams,
  freeWorkersOnly: boolean
): Record<string, LLMWorker> {
  const matchingWorkers = Object.keys(llmWorkers)
    .filter(
      (workerId) =>
        llmWorkers[workerId].modelName === params.modelName &&
        (!freeWorkersOnly || !llmWorkers[workerId].inferenceInProgress)
    )
    .reduce((acc, workerId) => {
      acc[workerId] = llmWorkers[workerId];
      return acc;
    }, {} as Record<string, LLMWorker>);

  return matchingWorkers;
}

export function runInference(
  params: InferenceParams,
  abortSignal?: AbortSignal
): AsyncGenerator<InferencePacket, void, unknown> {
  const freeWorkers = getMatchingWorkers(params, true);

  if (Object.keys(freeWorkers).length === 0) {
    throw new Error("No free workers available");
  }

  const selectedRandomWorkerId =
    Object.keys(freeWorkers)[
      Math.floor(Math.random() * Object.keys(freeWorkers).length)
    ];
  return runInferenceOnWorker(params, selectedRandomWorkerId, abortSignal);
}

export function abortWorkerInference(workerId: string) {
  if (
    llmWorkers[workerId] &&
    llmWorkers[workerId].llmEngine &&
    llmWorkers[workerId].inferenceInProgress
  ) {
    llmWorkers[workerId].llmEngine.interruptGenerate();
    llmWorkers[workerId].inferenceInProgress = false;
    llmWorkers[workerId].inferencePromise?.resolve(false);
    logEngineEvent({
      type: "engine_inference_error",
      workerId,
      inferenceId: inferenceCounter,
      error: "Inference manually aborted with control signal from the engine",
    });
  }
}

export async function* runInferenceOnWorker(
  params: InferenceParams,
  workerId: string,
  abortSignal?: AbortSignal
): AsyncGenerator<InferencePacket, void, unknown> {
  if (
    !llmWorkers[workerId] ||
    !llmWorkers[workerId].llmEngine ||
    !llmWorkers[workerId].modelLoadingPromise
  ) {
    throw new Error("Engine not loaded");
  }

  await llmWorkers[workerId].modelLoadingPromise!.promise;

  if (llmWorkers[workerId].inferenceInProgress) {
    throw new Error("Inference already in progress");
  }

  const inferenceId = inferenceCounter++;

  logEngineEvent({
    type: "engine_inference_start",
    workerId,
    inferenceId,
    params,
  });

  llmWorkers[workerId].inferenceInProgress = true;
  llmWorkers[workerId].inferencePromise = new DeferredPromise<boolean>();

  const outputLogIndex = logEngineEvent({
    type: "engine_inference_streaming_result",
    workerId,
    inferenceId,
    completed: false,
    tokenCount: 0,
    result: "",
  });

  try {
    const responseGenerator = await llmWorkers[
      workerId
    ].llmEngine!.chat.completions.create({
      stream: true,
      messages: params.messages,
      temperature: 1.0, // TODO: Make these part of the params later
      max_gen_len: 2048,
    });

    let fullMessage = "";
    let tokens = 0;

    for await (const chunk of responseGenerator) {
      if (abortSignal?.aborted) {
        llmWorkers[workerId].llmEngine!.interruptGenerate();
        llmWorkers[workerId].inferenceInProgress = false;
        llmWorkers[workerId].inferencePromise!.resolve(false);

        logEngineEvent({
          type: "engine_inference_error",
          workerId,
          inferenceId,
          error:
            "Inference manually aborted with control signal during inference",
        });

        yield {
          type: "error",
          error: "Inference manually aborted with control signal",
        };

        return;
      }

      if (chunk.choices[0].delta.content) {
        const packet: InferencePacket = {
          type: "token",
          token: chunk.choices[0].delta.content,
        };

        fullMessage += chunk.choices[0].delta.content;
        tokens++;

        // console.log(
        //   `Worker ${workerId}: Inference ${inferenceId} yielded token ${tokens} - ${chunk.choices[0].delta.content}`
        // );

        updateStreamingLogResult(packet, outputLogIndex);
        yield packet;
      }
      // TODO: Implement abortcontroller with a function that can be called to abort inference in progress
    }

    const tokenCountPacket: InferencePacket = {
      type: "tokenCount",
      tokenCount: tokens,
    };
    updateStreamingLogResult(tokenCountPacket, outputLogIndex);
    yield tokenCountPacket;

    const fullMessagePacket: InferencePacket = {
      type: "fullMessage",
      message: fullMessage,
    };

    updateStreamingLogResult(fullMessagePacket, outputLogIndex);
    yield fullMessagePacket;

    llmWorkers[workerId].inferenceInProgress = false;
    llmWorkers[workerId].inferencePromise!.resolve(true);
  } catch (err) {
    console.error(`Worker ${workerId}: Error running inference`, err);
    llmWorkers[workerId].inferenceInProgress = false;
    llmWorkers[workerId].inferencePromise!.resolve(false);

    logEngineEvent({
      type: "engine_inference_error",
      workerId,
      inferenceId,
      error: err,
    });

    yield {
      type: "error",
      error: err,
    };
  }
}
