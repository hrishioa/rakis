"use client";

import { useEffect } from "react";
import { createWorkerFactory, useWorker } from "@shopify/react-web-worker";

const createWorker = createWorkerFactory(
  () => import("../../../workers/llm-worker")
);

export default function Home() {
  const worker = useWorker(createWorker);

  async function askLLM(message: string) {
    const response = await worker.runInference("Llama-3-8B-Instruct-q4f32_1", [
      {
        content: message,
        role: "user",
      },
    ]);

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

  useEffect(() => {
    // console.log("Initializing llm worker...");
    // worker.loadModel("Llama-3-8B-Instruct-q4f32_1").then(() => {
    //   console.log("Model assigned to load.");
    // });

    (async () => {
      console.log("Chatting to model...");

      (window as any).askLLM = askLLM;

      const response = await worker.runInference(
        "Llama-3-8B-Instruct-q4f32_1",
        [
          {
            content: "Hello, what is your name?",
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
    })();
  }, []);

  return "Testing llm calls...";
}
