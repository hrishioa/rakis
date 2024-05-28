"use client";

import { useEffect, useRef, useState } from "react";
import { createWorkerFactory, useWorker } from "@shopify/react-web-worker";
import * as webllm from "@mlc-ai/web-llm";

const createWorker = createWorkerFactory(
  () => import("../../workers/llm-worker")
);

export default function Home() {
  const worker = useWorker(createWorker);
  const llmInit = useRef<boolean | "loading">(false);
  const [modelLoaded, setModelLoaded] = useState(false);
  const llmEngine = useRef<webllm.EngineInterface | null>(null);

  useEffect(() => {
    if (!llmInit.current) {
      llmInit.current = "loading";
      (async () => {
        console.log("Initializing llm worker...");
        const selectedModel = "Llama-3-8B-Instruct-q4f32_1";
        if (!llmEngine.current)
          llmEngine.current = await webllm.CreateEngine(selectedModel, {
            initProgressCallback: (report: webllm.InitProgressReport) => {
              console.log("Progress loading model - ", report);
              if (report.progress === 1) {
                llmInit.current = true;
                console.log("Setting model loaded to true");
                setModelLoaded(true);
              }
            },
          });
      })();
    }
  }, []);

  useEffect(() => {
    if (modelLoaded) {
      console.log("Sending message - ");
      (async () => {
        if (llmEngine.current) {
          const completion = await llmEngine.current.chat.completions.create({
            stream: true,
            messages: [
              {
                role: "user",
                content: "What is the meaning of life?",
              },
            ],
          });

          for await (const chunk of completion) {
            console.log("Got chunk ", chunk);
            console.log(
              chunk.choices.map((choice) => choice.delta.content).join("")
            );
          }
        }
      })();
    }
  }, [modelLoaded]);

  return "Testing llm calls...";
}
