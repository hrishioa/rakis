import * as webllm from "@mlc-ai/web-llm";
import { DeferredPromise } from "../utils/deferredpromise";

const availableModels = [
  "Llama-3-8B-Instruct-q4f32_1",
  "Llama-2-7b-chat-hf-q4f16_1",
  "Llama-2-13b-chat-hf-q4f16_1",
  "Mistral-7B-Instruct-v0.2-q4f16_1",
  "Hermes-2-Pro-Mistral-7B-q4f16_1",
  "gemma-2b-it-q4f16_1",
  "TinyLlama-1.1B-Chat-v0.4-q0f16",
] as const;

export type InferenceParams = {
  modelName: (typeof availableModels)[number];
  messages: webllm.ChatCompletionMessageParam[];
  waitForLoad?: boolean;
  queueIfBusy?: boolean;
  maxQueueDepth?: number;
};

export type InferencePacket =
  | {
      type: "token";
      token: string;
    }
  | {
      type: "fullMessage";
      message: string;
    }
  | {
      type: "error";
      error: any;
    };

export type EngineLogEntry =
  | {
      type: "engine_loading";
      at: Date;
    }
  | {
      type: "engine_loaded";
      at: Date;
    }
  | {
      type: "engine_loading_error";
      at: Date;
      error: any;
    }
  | {
      type: "engine_inference_start";
      inferenceId: number;
      at: Date;
      params: InferenceParams;
    }
  | {
      type: "engine_inference_error";
      inferenceId: number;
      at: Date;
      error: any;
    }
  | {
      type: "engine_inference_streaming_result";
      completed: boolean;
      inferenceId: number;
      at: Date;
      tokens: number;
      output: string;
    }
  | {
      type: "engine_unloading";
      at: Date;
    }
  | {
      type: "engine_unloaded";
      at: Date;
    };

const engineLogs: EngineLogEntry[] = [];

let engineInstance: null | {
  engine?: webllm.EngineInterface;
  state: "loading" | "processing" | "ready";
  loadingPromise: DeferredPromise<void>;
} = null;

export async function loadModel(modelName: (typeof availableModels)[number]) {
  try {
    if (engineInstance) {
      if (engineInstance.state === "ready") {
        return true;
      } else if (engineInstance.state === "loading") {
        await engineInstance.loadingPromise.promise;
        return true;
      }
    }

    engineLogs.push({ type: "engine_loading", at: new Date() });

    engineInstance = {
      state: "loading",
      loadingPromise: new DeferredPromise<void>(),
    };

    engineInstance.engine = await webllm.CreateEngine(modelName, {
      initProgressCallback: (report: webllm.InitProgressReport) => {
        console.log(`Progress loading ${modelName} - `, report);
        if (report.progress === 1) {
          engineInstance!.state = "ready";
          engineInstance!.loadingPromise.resolve();
          engineLogs.push({ type: "engine_loaded", at: new Date() });
        }
      },
    });

    await engineInstance.loadingPromise.promise;

    return true;
  } catch (err) {
    console.error("Error loading model - ", err);
    engineLogs.push({
      type: "engine_loading_error",
      at: new Date(),
      error: err,
    });
    return false;
  }
}

export async function unloadModel() {
  if (engineInstance) {
    engineLogs.push({ type: "engine_unloading", at: new Date() });
    await engineInstance.engine?.unload();
    engineInstance = null;
    engineLogs.push({ type: "engine_unloaded", at: new Date() });
  }
}

export function getEngineLogs({
  fromTime,
  toTime,
  lastN,
}: {
  fromTime?: Date;
  toTime?: Date;
  lastN?: number;
}) {
  let logs = engineLogs;

  if (fromTime) {
    logs = logs.filter((log) => log.at >= fromTime);
  }

  if (toTime) {
    logs = logs.filter((log) => log.at <= toTime);
  }

  if (lastN) {
    logs = logs.slice(-lastN);
  }

  return logs;
}

export async function* runInference(
  params: InferenceParams
): AsyncGenerator<InferencePacket, void, unknown> {
  const {
    modelName,
    messages,
    waitForLoad = true,
    queueIfBusy = true,
    maxQueueDepth = 10,
  } = params;

  if (!engineInstance || engineInstance.state === "loading") {
    if (waitForLoad) {
      console.log("Loading model...");
      const success = await loadModel(modelName);
      if (!success) {
        return;
      }
    } else {
      console.log("Model is not loaded, not waiting.");

      yield {
        type: "error",
        error: "Model is not loaded",
      };

      return;
    }
  }

  if (!engineInstance || !engineInstance.engine || !engineInstance.state) {
    yield {
      type: "error",
      error: "Engine could not be loaded",
    };
    return;
  }

  if (engineInstance.state === "processing" && queueIfBusy) {
    // TODO: We need to keep track of pending inference requests, wait for them to finish, then run ours
  }

  const inferenceId = engineLogs.length * 10 + Math.floor(Math.random() * 10); // Poor man's hash collision avoidance
  engineLogs.push({
    type: "engine_inference_start",
    inferenceId,
    at: new Date(),
    params,
  });

  engineInstance.state = "processing";

  const streamingResultLog: EngineLogEntry = {
    type: "engine_inference_streaming_result",
    completed: false,
    tokens: 0,
    inferenceId,
    at: new Date(),
    output: "",
  };

  engineLogs.push(streamingResultLog);

  try {
    const response = await engineInstance.engine!.chat.completions.create({
      stream: true,
      messages,
      max_gen_len: 2048,
    });

    for await (const chunk of response) {
      const textChunk = chunk.choices
        .map((choice) => choice.delta.content)
        .join("");

      streamingResultLog.output += textChunk;
      streamingResultLog.tokens++;

      yield {
        type: "token",
        token: textChunk,
      };
    }

    streamingResultLog.completed = true;

    yield {
      type: "fullMessage",
      message: streamingResultLog.output,
    };

    engineInstance.state = "ready";
  } catch (error) {
    engineLogs.push({
      type: "engine_inference_error",
      inferenceId,
      at: new Date(),
      error,
    });
    engineInstance.state = "ready";
    console.error("Inference error - ", error);

    yield {
      type: "error",
      error,
    };
  }
}
