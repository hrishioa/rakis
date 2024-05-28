import * as webllm from "@mlc-ai/web-llm";
import { DeferredPromise } from "../utils/deferredpromise";

const availableModels = ["Llama-3-8B-Instruct-q4f32_1"] as const;

const loadedEngines: {
  [key in (typeof availableModels)[number]]?: {
    engine?: webllm.EngineInterface;
    state: "loading" | "processing" | "ready";
    loadingPromise: DeferredPromise<void>;
  };
} = {};

export async function loadModel(modelName: (typeof availableModels)[number]) {
  try {
    if (!loadedEngines[modelName]) {
      console.log("actually loading model...", modelName);
      loadedEngines[modelName] = {
        state: "loading",
        loadingPromise: new DeferredPromise<void>(),
      };

      loadedEngines[modelName]!.engine = await webllm.CreateEngine(modelName, {
        initProgressCallback: (report: webllm.InitProgressReport) => {
          console.log(`Progress loading ${modelName} - `, report);
          if (report.progress === 1) {
            loadedEngines[modelName]!.state = "ready";
            loadedEngines[modelName]!.loadingPromise.resolve();
          }
        },
      });
    }

    await loadedEngines[modelName]!.loadingPromise.promise;

    return true;
  } catch (err) {
    console.error("Error loading model - ", err);
    return false;
  }
}

export async function runInference(
  modelName: (typeof availableModels)[number],
  messages: webllm.ChatCompletionMessageParam[]
) {
  if (!loadedEngines[modelName]) {
    console.log("Loading model...");
    await loadModel(modelName);
  }

  if (loadedEngines[modelName]!.state !== "ready") {
    console.log("Model not ready...");
    return false;
  }

  if (!loadedEngines[modelName] || !loadedEngines[modelName]!.engine) {
    console.error("No engine found...");
    return false;
  }

  return await loadedEngines[modelName]!.engine!.chat.completions.create({
    stream: true,
    messages,
    max_gen_len: 2048,
  });
}
