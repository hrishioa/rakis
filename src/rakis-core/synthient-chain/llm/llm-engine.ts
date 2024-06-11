// llm-engine.ts
import { DeferredPromise } from "../utils/deferredpromise";
import * as webllm from "@mlc-ai/web-llm";
import {
  availableModels,
  InferencePacket,
  InferenceParams,
  LLMEngineLogEntry,
  LLMModelName,
  LLMWorker,
} from "./types";
import EventEmitter from "eventemitter3";
import {
  InferenceErrorPayload,
  InferenceSuccessPayload,
} from "../db/packet-types";
import { generateRandomString } from "../utils/utils";
import { createLogger, logStyles } from "../utils/logger";
import { LLM_ENGINE_SETTINGS } from "../thedomain/settings";

type LLMEngineEvents = {
  workerLoadFailed: (data: {
    modelName: LLMModelName;
    workerId: string;
    error: any;
  }) => void;
  workerLoaded: (data: { modelName: LLMModelName; workerId: string }) => void;
  workerUnloaded: (data: { workerId: string }) => void;
  workerFree: (data: { workerId: string }) => void;
};

const logger = createLogger("LLM Engine", logStyles.llmEngine.main);

export class LLMEngine extends EventEmitter<LLMEngineEvents> {
  public llmWorkers: Record<string, LLMWorker> = {};
  // TODO: Move this into indexedDB
  private engineLog: LLMEngineLogEntry[] = [];
  private inferenceCounter: number = 0;

  private logEngineEvent(entry: LLMEngineLogEntry): number {
    if (!entry.at) entry.at = new Date();
    const logLength = this.engineLog.length;

    logger.debug(`Engine event ${entry.type}`, entry);

    this.engineLog.push(entry);

    if (this.engineLog.length > LLM_ENGINE_SETTINGS.engineLogLimit)
      this.engineLog = this.engineLog.slice(
        -LLM_ENGINE_SETTINGS.engineLogLimit
      );

    return logLength;
  }

  public searchEngineLogs(type: string, workerId: string): LLMEngineLogEntry[] {
    return this.engineLog.filter(
      (entry) => entry.type === type && entry.workerId === workerId
    );
  }

  public getEngineLogs(lastNPackets: number): LLMEngineLogEntry[] {
    return this.engineLog.slice(-lastNPackets);
  }

  private updateStreamingLogResult(
    packet: InferencePacket,
    logEntryIndex: number
  ) {
    const logEntry = this.engineLog[logEntryIndex];

    if (logEntry.type === "engine_inference_streaming_result") {
      if (packet.type === "token") {
        logEntry.result += packet.token;
        logEntry.tokenCount++;
      } else if (packet.type === "fullMessage") {
        logEntry.result = packet.message;
        logEntry.completed = true;
      } else if (packet.type === "tokenCount") {
        logEntry.tokenCount = packet.tokenCount;
      }
    }
  }

  public getWorkerStates(): {
    [workerId: string]: { modelName: LLMModelName; state: string };
  } {
    return Object.keys(this.llmWorkers).reduce((acc, cur) => {
      acc[cur] = {
        modelName: this.llmWorkers[cur].modelName,
        state: this.llmWorkers[cur].inferenceInProgress
          ? "inference-in-progress"
          : this.llmWorkers[cur].modelLoadingProgress < 1
          ? "loading"
          : "idle",
      };
      return acc;
    }, {} as { [workerId: string]: { modelName: LLMModelName; state: string } });
  }

  public getWorkerAvailability(modelNames: LLMModelName[]): {
    [modelName: string]: { count: number; free: number };
  } {
    return Object.values(this.llmWorkers).reduce((acc, cur) => {
      if (modelNames.includes(cur.modelName)) {
        acc[cur.modelName] ??= { count: 0, free: 0 };
        acc[cur.modelName].count++;
        if (!cur.inferenceInProgress && cur.modelLoadingProgress >= 1)
          acc[cur.modelName].free++;
      }
      return acc;
    }, {} as { [modelName: string]: { count: number; free: number } });
  }

  public async unloadWorker(workerId: string, abruptKill: boolean = false) {
    if (this.llmWorkers[workerId]) {
      if (!abruptKill)
        await this.llmWorkers[workerId].inferencePromise?.promise;

      this.llmWorkers[workerId].llmEngine?.unload();
      delete this.llmWorkers[workerId];
      this.logEngineEvent({
        type: "engine_unload",
        workerId,
      });

      this.emit("workerUnloaded", { workerId });
    }
  }

  public async getWorkerState(workerId: string) {
    if (!this.llmWorkers[workerId]) return null;

    if (this.llmWorkers[workerId].modelLoadingProgress < 1) {
      return {
        state: "loading",
        loadingProgress: this.llmWorkers[workerId].modelLoadingProgress,
      };
    } else if (this.llmWorkers[workerId].inferenceInProgress) {
      return {
        state: "inference-in-progress",
      };
    } else {
      return {
        state: "idle",
      };
    }
  }

  public async loadWorker(
    modelName: (typeof availableModels)[number],
    workerId: string
  ) {
    this.llmWorkers[workerId] ??= {
      modelName,
      modelLoadingProgress: 0,
    };

    if (this.llmWorkers[workerId].modelLoadingPromise) {
      logger.debug(
        `Tried to create worker ${workerId}, but creation is already done or in progress`
      );
      return await this.llmWorkers[workerId]!.modelLoadingPromise!.promise;
    }

    this.llmWorkers[workerId].modelLoadingPromise = new DeferredPromise<
      boolean | string
    >();

    try {
      this.logEngineEvent({
        type: "engine_loading",
        modelName,
        workerId,
      });

      this.llmWorkers[workerId].llmEngine =
        await webllm.CreateWebWorkerMLCEngine(
          new Worker(new URL("./mlc-worker.ts", import.meta.url), {
            type: "module",
          }),
          modelName,
          {
            initProgressCallback: (report: webllm.InitProgressReport) => {
              logger.debug(
                `Worker ${workerId}: Loading ${modelName} progress - `,
                report
              );

              this.llmWorkers[workerId].modelLoadingProgress = report.progress;
              if (report.progress === 1) {
                if (
                  !this.searchEngineLogs("engine_loaded", workerId).filter(
                    (entry) => (entry as any).modelName === modelName
                  ).length
                ) {
                  this.logEngineEvent({
                    type: "engine_loaded",
                    modelName,
                    workerId,
                  });

                  this.emit("workerLoaded", { modelName, workerId });
                  this.emit("workerFree", { workerId });
                }
                this.llmWorkers[workerId].modelLoadingPromise?.resolve(
                  workerId
                );
              }
            },
          }
        );
    } catch (err) {
      this.emit("workerLoadFailed", { modelName, workerId, error: err });

      this.logEngineEvent({
        type: "engine_loading_error",
        modelName,
        workerId,
        error: err,
      });
      logger.error(
        `Worker ${workerId}: Error loading ${modelName}: ${err}`,
        err
      );
      this.llmWorkers[workerId].modelLoadingPromise?.reject(err);
    }

    return await this.llmWorkers[workerId]!.modelLoadingPromise!.promise;
  }

  private getMatchingWorkers(
    params: InferenceParams,
    freeWorkersOnly: boolean
  ): Record<string, LLMWorker> {
    const matchingWorkers = Object.keys(this.llmWorkers)
      .filter(
        (workerId) =>
          this.llmWorkers[workerId].modelName === params.modelName &&
          this.llmWorkers[workerId].modelLoadingProgress >= 1 &&
          (!freeWorkersOnly || !this.llmWorkers[workerId].inferenceInProgress)
      )
      .reduce((acc, workerId) => {
        acc[workerId] = this.llmWorkers[workerId];
        return acc;
      }, {} as Record<string, LLMWorker>);

    return matchingWorkers;
  }

  public async runInferenceNonStreaming(
    params: InferenceParams
  ): Promise<InferenceSuccessPayload | InferenceErrorPayload> {
    const response = await this.runInference(params);

    let fullMessage = "";
    let tokenCount = 0;

    for await (const packet of response) {
      if (packet.type === "fullMessage") {
        fullMessage = packet.message;
      } else if (packet.type === "error") {
        return {
          success: false,
          error: packet.error,
        };
      } else if (packet.type === "tokenCount") {
        tokenCount = packet.tokenCount;
      } else if (packet.type === "token") {
        fullMessage += packet.token;
        tokenCount++;
      }
    }

    // TODO: This could use more work streamlining, just tired tonight
    return {
      success: true,
      result: fullMessage,
      tokenCount,
    };
  }

  public async *runInference(
    params: InferenceParams,
    abortSignal?: AbortSignal
  ): AsyncGenerator<InferencePacket, void, unknown> {
    const freeWorkers = this.getMatchingWorkers(params, true);

    if (Object.keys(freeWorkers).length === 0) {
      throw new Error("No free workers available");
    }

    const selectedRandomWorkerId =
      Object.keys(freeWorkers)[
        Math.floor(Math.random() * Object.keys(freeWorkers).length)
      ];

    const res = await this.runInferenceOnWorker(
      params,
      selectedRandomWorkerId,
      abortSignal
    );

    for await (const packet of res) {
      yield packet;
    }
  }

  public abortWorkerInference(workerId: string) {
    const worker = this.llmWorkers[workerId];

    if (worker && worker.llmEngine && worker.inferenceInProgress) {
      worker.llmEngine.interruptGenerate();
      worker.inferenceInProgress = false;
      worker.inferencePromise?.resolve(false);
      this.logEngineEvent({
        type: "engine_inference_error",
        workerId,
        inferenceId: this.inferenceCounter,
        error: "Inference manually aborted with control signal from the engine",
      });
    }
  }

  public async *runInferenceOnWorker(
    params: InferenceParams,
    workerId: string,
    abortSignal?: AbortSignal
  ): AsyncGenerator<InferencePacket, void, unknown> {
    if (
      !this.llmWorkers[workerId] ||
      !this.llmWorkers[workerId].llmEngine ||
      !this.llmWorkers[workerId].modelLoadingPromise
    ) {
      throw new Error("Engine not loaded");
    }

    await this.llmWorkers[workerId].modelLoadingPromise!.promise;

    if (this.llmWorkers[workerId].inferenceInProgress) {
      throw new Error("Inference already in progress");
    }

    const inferenceId = this.inferenceCounter++;

    this.logEngineEvent({
      type: "engine_inference_start",
      workerId,
      inferenceId,
      params,
    });

    this.llmWorkers[workerId].inferenceInProgress = true;
    this.llmWorkers[workerId].inferencePromise = new DeferredPromise<boolean>();

    const outputLogIndex = this.logEngineEvent({
      type: "engine_inference_streaming_result",
      workerId,
      inferenceId,
      completed: false,
      tokenCount: 0,
      result: "",
    });

    try {
      const responseGenerator = await this.llmWorkers[
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
          this.llmWorkers[workerId].llmEngine!.interruptGenerate();
          this.llmWorkers[workerId].inferenceInProgress = false;
          this.llmWorkers[workerId].inferencePromise!.resolve(false);

          this.logEngineEvent({
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

          this.updateStreamingLogResult(packet, outputLogIndex);
          yield packet;
        }
      }

      const tokenCountPacket: InferencePacket = {
        type: "tokenCount",
        tokenCount: tokens,
      };
      this.updateStreamingLogResult(tokenCountPacket, outputLogIndex);
      yield tokenCountPacket;

      const fullMessagePacket: InferencePacket = {
        type: "fullMessage",
        message: fullMessage,
      };

      this.updateStreamingLogResult(fullMessagePacket, outputLogIndex);
      yield fullMessagePacket;

      this.llmWorkers[workerId].inferenceInProgress = false;
      this.llmWorkers[workerId].inferencePromise!.resolve(true);
    } catch (err) {
      logger.error(`Worker ${workerId}: Error running inference`, err);
      this.llmWorkers[workerId].inferenceInProgress = false;
      this.llmWorkers[workerId].inferencePromise!.resolve(false);

      this.logEngineEvent({
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

    this.emit("workerFree", { workerId });
  }

  async scaleLLMWorkers(
    modelName: LLMModelName,
    count: number,
    abruptKill: boolean = false
  ) {
    try {
      const numberOfExistingWorkers = Object.values(this.llmWorkers).filter(
        (worker) => worker.modelName === modelName
      ).length;

      if (numberOfExistingWorkers === count) return;

      if (numberOfExistingWorkers < count) {
        logger.debug(
          `Scaling up number of llm workers for ${modelName} to ${count}`
        );
        const scaleUpPromises: Promise<any>[] = [];
        for (let i = 0; i < count - numberOfExistingWorkers; i++) {
          const workerId = `llm-${modelName}-${generateRandomString()}`;
          scaleUpPromises.push(this.loadWorker(modelName, workerId));
        }

        // TODO: Process errors
      } else {
        logger.debug(
          `Scaling down number of llm workers for ${modelName} to ${count}`
        );

        const workerIdsByLoad = Object.keys(this.llmWorkers).sort((a, b) =>
          this.llmWorkers[a].inferenceInProgress ===
          this.llmWorkers[b].inferenceInProgress
            ? 0
            : this.llmWorkers[a].inferenceInProgress
            ? -1
            : 1
        );

        const workerIdsToScaleDown = workerIdsByLoad.slice(
          0,
          numberOfExistingWorkers - count
        );

        const scaleDownPromises: Promise<any>[] = [];
        for (const workerId of workerIdsToScaleDown) {
          scaleDownPromises.push(this.unloadWorker(workerId, abruptKill));
        }

        // TODO: Process errors
      }
    } catch (err) {
      logger.error("Error updating LLM workers", err);
    }
  }
}
