"use client";

import { useEffect, useRef } from "react";
import { TheDomain } from "../core/synthient-chain/thedomain/thedomain";
export default function Home() {
  const domainMutex = useRef(false);

  useEffect(() => {
    if (domainMutex.current) return;
    domainMutex.current = true;
    TheDomain.bootup({
      identityPassword: "test-password",
      overwriteIdentity: true,
      initialLLMWorkers: [
        {
          modelName: "gemma-2b-it-q4f16_1",
          count: 1,
        },
      ],
      initialEmbeddingWorkers: [
        {
          modelName: "nomic-ai/nomic-embed-text-v1.5",
          count: 1,
        },
      ],
    });
  });

  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      Welcome to Synthient!
    </main>
  );
}
