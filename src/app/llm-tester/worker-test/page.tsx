"use client";

import { useEffect } from "react";
import { createWorkerFactory, useWorker } from "@shopify/react-web-worker";

const createLLMWorker = createWorkerFactory(
  () => import("../../../workers/llm-worker")
);

const createEmbeddingsWorker = createWorkerFactory(
  () => import("../../../workers/embedding-worker")
);

export default function Home() {
  const llmWorker = useWorker(createLLMWorker);
  const embeddingsWorker = useWorker(createEmbeddingsWorker);

  async function askLLM(message: string) {
    const response = await llmWorker.runInference(
      "Llama-3-8B-Instruct-q4f32_1",
      [
        {
          content: message,
          role: "user",
        },
      ]
    );

    if (response) {
      for await (const chunk of response) {
        console.log(
          "Got response - ",
          chunk.choices.map((choice) => choice.delta.content).join("")
        );
      }
    } else {
      console.log("Failed");
    }
  }

  // useEffect(() => {
  //   (async () => {
  //     console.log("Loading LLM model");
  //     await llmWorker.loadModel("Llama-3-8B-Instruct-q4f32_1");
  //     (window as any).askLLM = askLLM;
  //   })();
  // }, []);

  useEffect(() => {
    console.log("Embeddings useeffect");
    (async () => {
      console.log("Computing embeddings...");

      const embedding = await embeddingsWorker.embedText(
        "Hello how are you?",
        "Xenova/all-MiniLM-L6-v2"
      );

      console.log("Got - ", embedding);
    })();
  }, []);

  return "Testing llm calls...";
}
