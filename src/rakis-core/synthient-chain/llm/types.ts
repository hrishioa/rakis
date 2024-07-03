import type {
  MLCEngineInterface,
  ChatCompletionMessageParam,
} from "@mlc-ai/web-llm";
import type { DeferredPromise } from "../utils/deferredpromise";

export const availableModels = [
  "Llama-3-8B-Instruct-q4f32_1",
  "Llama-2-7b-chat-hf-q4f16_1",
  "Llama-2-13b-chat-hf-q4f16_1",
  "Mistral-7B-Instruct-v0.2-q4f16_1",
  "Hermes-2-Pro-Mistral-7B-q4f16_1",
  "gemma-2b-it-q4f16_1",
  "TinyLlama-1.1B-Chat-v0.4-q0f16",
] as const;

export type LLMModelName = (typeof availableModels)[number];

export type AvailableModel = typeof availableModels[number];

export type LLMWorkerStates = {
  [workerId: string]: {
    modelName: LLMModelName;
    state: "inference-in-progress" | "idle" | "loading";
    loadingProgress: number;
  };
};

export type LLMWorker = {
  modelName: LLMModelName;
  llmEngine?: MLCEngineInterface;
  modelLoadingPromise?: DeferredPromise<boolean | string>;
  modelLoadingProgress: number;
  inferenceInProgress?: boolean;
  inferencePromise?: DeferredPromise<boolean>;
};

export type InferenceParams = {
  modelName: LLMModelName;
  messages: ChatCompletionMessageParam[];
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
      type: "tokenCount";
      tokenCount: number;
    }
  | {
      type: "error";
      error: any;
    };

export type LLMWorkerLogEntryRaw =
  | {
      type: "engine_loading" | "engine_loaded";
      modelName: LLMModelName;
    }
  | {
      type: "engine_unload";
    }
  | {
      type: "engine_loading_error";
      modelName: LLMModelName;
      error: any;
    }
  | {
      type: "engine_inference_start";
      inferenceId: number;
      params: InferenceParams;
    }
  | {
      type: "engine_inference_error";
      inferenceId: number;
      error: any;
    }
  | {
      type: "engine_inference_streaming_result";
      inferenceId: number;
      result: string;
      completed: boolean;
      tokenCount: number;
    };

export type LLMWorkerLogEntry = LLMWorkerLogEntryRaw & {
  workerId: string;
};

export type LLMEngineLogEntry = LLMWorkerLogEntry & {
  at?: Date;
};
