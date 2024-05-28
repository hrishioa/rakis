import { useState, useRef, useEffect } from "react";
import { createWorkerFactory } from "@shopify/react-web-worker";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { EngineInterface } from "@mlc-ai/web-llm";
import { DeferredPromise } from "../../utils/deferredpromise";
import { LLMModelName } from "../../core/llm/types";

const createLLMWorker = createWorkerFactory(
  () => import("../../core/llm/llm-engine")
);

type LLMWorker = ReturnType<typeof createLLMWorker>;

type LLMWorkerProps = {
  selectedModel: LLMModelName;
  workerIndex: number;
  key: number;
};

const LLMWorkerComponent = ({ selectedModel, workerIndex }: LLMWorkerProps) => {
  const [llmWorker, setLLMWorker] = useState<LLMWorker | null>(null);
  const workerId = `worker-${workerIndex}`;
  const [inferenceResult, setInferenceResult] = useState("");
  const textboxRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const initWorker = async () => {
      console.log("Creating new worker");
      const newWorker = createLLMWorker();
      await newWorker.loadWorker(selectedModel, workerId);
      console.log("Worker created with id ", workerId);
      setLLMWorker(newWorker);
    };
    initWorker();
  }, [selectedModel, workerId]);

  const runInference = async (message: string) => {
    if (!llmWorker) return;

    setInferenceResult((prevResult) => prevResult + "\n\n---\n\n");

    const startTime = Date.now();
    const response = await llmWorker.runInferenceOnWorker(
      {
        modelName: selectedModel as any,
        messages: [{ content: message, role: "user" }],
      },
      workerId
    );

    let result = "";
    let tokens = 0;
    if (response) {
      for await (const packet of response) {
        if (packet.type === "token") {
          result += packet.token;
          setInferenceResult((prevResult) => prevResult + packet.token);
        } else if (packet.type === "error") {
          setInferenceResult(
            (prevResult) => prevResult + "\n\nError: " + packet.error
          );
        } else if (packet.type === "tokenCount") {
          tokens = packet.tokenCount;
          setInferenceResult(
            (prevResult) => prevResult + "\n\nToken count: " + packet.tokenCount
          );
        }
      }
    } else {
      result = "Failed";
    }

    const endTime = Date.now();
    const elapsedTime = (endTime - startTime) / 1000;
    const tokensPerSecond = tokens / elapsedTime;

    setInferenceResult(
      (prevResult) =>
        `${prevResult}\n\n---\n\nTokens per second: ${tokensPerSecond.toFixed(
          2
        )}`
    );
  };

  const handleSendClick = () => {
    if (textboxRef.current) {
      const message = textboxRef.current.value;
      runInference(message);
    }
  };

  return (
    <div className="mb-8">
      <h3 className="text-2xl font-semibold mb-2">Worker {workerId}</h3>
      <div className="flex items-center space-x-2">
        <Input
          ref={textboxRef}
          className="mb-2 flex-1"
          placeholder="Enter your message"
        />
        <Button onClick={handleSendClick}>Send</Button>
      </div>
      <pre className="mt-4 p-4 text-sm bg-gray-100 rounded-md text-wrap">
        {inferenceResult}
      </pre>
    </div>
  );
};

export default LLMWorkerComponent;
