"use client";

import React, { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  availableModels,
  InferenceParams,
  LLMEngineLogEntry,
  LLMModelName,
} from "../../../rakis-core/synthient-chain/llm/types";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "../../../components/ui/select";
import { Button } from "../../../components/ui/button";
import { Textarea } from "../../../components/ui/textarea";
import { Progress } from "../../../components/ui/progress";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../../../components/ui/collapsible";
import { ChevronsUpDown, X } from "lucide-react";
import {
  EmbeddingEngineLogEntry,
  EmbeddingResult,
} from "../../../rakis-core/synthient-chain/embeddings/types";
import { modelColors } from "./colors";
import { EmbeddingEngine } from "../../../rakis-core/synthient-chain/embeddings/embedding-engine";
import { LLMEngine } from "../../../rakis-core/synthient-chain/llm/llm-engine";
import { hashBinaryEmbedding } from "../../../rakis-core/synthient-chain/utils/simple-crypto";

const EmbeddingChart = dynamic(() => import("./embedding-chart"), {
  ssr: false,
});

const embeddingEngine = new EmbeddingEngine();
const llmEngine = new LLMEngine();

const LLMTestingPage: React.FC = () => {
  const [workerIds, setWorkerIds] = useState<string[]>([]);

  const [allEmbeddingsSoFar, setAllEmbeddingsSoFar] = useState<
    (EmbeddingResult & { modelName: LLMModelName })[]
  >([]);

  const [selectedModel, setSelectedModel] = useState<
    (typeof availableModels)[number]
  >(availableModels[0]);
  const [workerModels, setWorkerModels] = useState<Record<string, string>>({});
  const [workerPrompts, setWorkerPrompts] = useState<Record<string, string>>(
    {}
  );
  const [embeddingWorkerCount, setEmbeddingWorkerCount] = useState(0);
  const [requestedEmbeddingWorkerCount, setRequestedEmbeddingWorkerCount] =
    useState(2);
  const [globalPrompt, setGlobalPrompt] = useState<string>("");
  const [engineLog, setEngineLog] = useState<
    (LLMEngineLogEntry | EmbeddingEngineLogEntry)[]
  >([]);
  const [workerStatus, setWorkerStatus] = useState<
    Record<
      string,
      {
        tps: number;
        output: string;
        isLoading: boolean;
        state: string;
        loadingProgress: number;
        embeddingHash: string;
      }
    >
  >({});
  const [showEngineLog, setShowEngineLog] = useState(false);

  useEffect(() => {
    if (requestedEmbeddingWorkerCount < embeddingWorkerCount) {
      setEmbeddingWorkerCount(requestedEmbeddingWorkerCount);

      console.log(
        "Removing ",
        embeddingWorkerCount - requestedEmbeddingWorkerCount,
        " workers"
      );
      const removeEmbeddingWorkers = async () => {
        for (
          let i = embeddingWorkerCount - 1;
          i >= requestedEmbeddingWorkerCount;
          i--
        ) {
          const workerId = `embedding-worker-${i}`;
          console.log("Removing ", workerId);
          await embeddingEngine.deleteEmbeddingWorker(workerId);
        }
      };

      removeEmbeddingWorkers();
    } else if (requestedEmbeddingWorkerCount > embeddingWorkerCount) {
      setEmbeddingWorkerCount(requestedEmbeddingWorkerCount);

      console.log(
        "Adding ",
        requestedEmbeddingWorkerCount - embeddingWorkerCount,
        " workers"
      );

      const addEmbeddingWorkers = async () => {
        for (
          let i = embeddingWorkerCount;
          i < requestedEmbeddingWorkerCount;
          i++
        ) {
          const workerId = `embedding-worker-${i}`;
          console.log("Creating new embedding worker ", workerId);
          await embeddingEngine.addEmbeddingWorker(
            "nomic-ai/nomic-embed-text-v1.5",
            workerId
          );
          console.log("Added embedding worker", i);
        }
      };

      addEmbeddingWorkers();
    }
  }, [requestedEmbeddingWorkerCount, embeddingWorkerCount]);

  const pollWorkerState = async (workerId: string) => {
    try {
      const state = await llmEngine.getWorkerState(workerId);
      if (state) {
        setWorkerStatus((prevStatus) => ({
          ...prevStatus,
          [workerId]: {
            ...prevStatus[workerId],
            state: state.state,
            loadingProgress: state.loadingProgress || 1,
          },
        }));
      }
    } catch (error) {
      console.error(`Error fetching worker state for ${workerId}:`, error);
    }
  };

  const pollEngineLogs = async () => {
    try {
      const newLogs = await llmEngine.getEngineLogs(50);
      const latestEmbeddingLogs = embeddingEngine.getEmbeddingEngineLogs(50);

      const joinedLogs = [...newLogs, ...latestEmbeddingLogs].sort(
        (a, b) => a.at!.getTime() - b.at!.getTime()
      );

      if (joinedLogs.length > 0) {
        setEngineLog(joinedLogs);
      }
    } catch (error) {
      console.error("Error fetching engine logs:", error);
    }
  };

  useEffect(() => {
    const pollInterval = setInterval(pollEngineLogs, 1000);
    return () => {
      clearInterval(pollInterval);
    };
  }, []);

  const handleSpawnWorker = async () => {
    const workerId = Math.random().toString(36).substring(7);

    setWorkerIds((prevWorkerIds) => [...prevWorkerIds, workerId]);
    setWorkerModels((prevWorkerModels) => ({
      ...prevWorkerModels,
      [workerId]: selectedModel,
    }));
    setWorkerStatus((prevStatus) => ({
      ...prevStatus,
      [workerId]: {
        tps: 0,
        output: "",
        isLoading: true,
        state: "loading",
        loadingProgress: 0,
        embeddingHash: "",
      },
    }));

    const pollInterval = setInterval(() => pollWorkerState(workerId), 1000);

    try {
      await llmEngine.loadWorker(selectedModel, workerId);
    } catch (error) {
      console.error(`Error loading worker ${workerId}:`, error);
      setWorkerStatus((prevStatus) => {
        const { [workerId]: _, ...rest } = prevStatus;
        return rest;
      });
      setWorkerIds((prevWorkerIds) =>
        prevWorkerIds.filter((id) => id !== workerId)
      );
      clearInterval(pollInterval);
    }

    return () => {
      clearInterval(pollInterval);
    };
  };

  const handleWorkerInference = async (workerId: string) => {
    const prompt = workerPrompts[workerId];
    const params: InferenceParams = {
      modelName: workerModels[workerId] as any,
      messages: [{ role: "user", content: prompt }],
    };
    const inferenceIterable = llmEngine.runInferenceOnWorker(params, workerId);
    let tokens = 0;
    let outputText = "";
    const startTime = Date.now();
    for await (const packet of inferenceIterable) {
      if (packet.type === "token") {
        tokens++;
        outputText += packet.token;
        const elapsedTime = (Date.now() - startTime) / 1000; // Convert to seconds
        const tokensPerSecond = Math.round(tokens / elapsedTime);
        setWorkerStatus((prevStatus) => ({
          ...prevStatus,
          [workerId]: {
            tps: tokensPerSecond,
            output: outputText,
            isLoading: false,
            loadingProgress: workerStatus[workerId]?.loadingProgress || 1,
            state: workerStatus[workerId]?.state || "idle",
            embeddingHash: "",
          },
        }));
      }
    }

    // Embed the output and update the embeddingHash
    const embeddingResult = await embeddingEngine.embedText(
      [outputText],
      "nomic-ai/nomic-embed-text-v1.5"
    );

    if (embeddingResult && embeddingResult.length > 0)
      setAllEmbeddingsSoFar((prev) => [
        ...prev,
        ...embeddingResult.map((result) => ({
          ...result,
          modelName: workerModels[workerId] as LLMModelName,
        })),
      ]);

    if (embeddingResult && embeddingResult.length > 0) {
      const bEmbeddingHash = await hashBinaryEmbedding(
        embeddingResult[0].binaryEmbedding,
        workerId
      );

      setWorkerStatus((prevStatus) => ({
        ...prevStatus,
        [workerId]: {
          ...prevStatus[workerId],
          embeddingHash: bEmbeddingHash,
        },
      }));
    }
  };

  const handleGlobalInference = async () => {
    const freeWorkerIds = workerIds;

    const inferencePromises = freeWorkerIds.map(async (workerId) => {
      const params: InferenceParams = {
        modelName: workerModels[workerId] as any,
        messages: [{ role: "user", content: globalPrompt }],
      };

      try {
        const inferenceIterable = llmEngine.runInferenceOnWorker(
          params,
          workerId
        );
        let tokens = 0;
        let outputText = "";
        const startTime = Date.now();

        for await (const packet of inferenceIterable) {
          if (packet.type === "token") {
            tokens++;
            outputText += packet.token;
            const elapsedTime = (Date.now() - startTime) / 1000; // Convert to seconds
            const tokensPerSecond = Math.round(tokens / elapsedTime);
            setWorkerStatus((prevStatus) => ({
              ...prevStatus,
              [workerId]: {
                tps: tokensPerSecond,
                output: outputText,
                isLoading: true,
                loadingProgress: workerStatus[workerId]?.loadingProgress || 1,
                state: workerStatus[workerId]?.state || "idle",
                embeddingHash: "",
              },
            }));
          }
        }

        // Embed the output and update the embeddingHash
        const embeddingResult = await embeddingEngine.embedText(
          [outputText],
          "nomic-ai/nomic-embed-text-v1.5"
        );

        if (embeddingResult && embeddingResult.length > 0)
          setAllEmbeddingsSoFar((prev) => [
            ...prev,
            ...embeddingResult.map((result) => ({
              ...result,
              modelName: workerModels[workerId] as LLMModelName,
            })),
          ]);

        if (embeddingResult && embeddingResult.length > 0) {
          const bEmbeddingHash = await hashBinaryEmbedding(
            embeddingResult[0].binaryEmbedding,
            workerId
          );

          setWorkerStatus((prevStatus) => ({
            ...prevStatus,
            [workerId]: {
              ...prevStatus[workerId],
              isLoading: false,
              bEmbeddingHash,
            },
          }));
        }
      } catch (error) {
        console.error(`Error running inference on worker ${workerId}:`, error);
      }
    });

    await Promise.all(inferencePromises);
  };

  const handleAbortInference = (workerId: string) => {
    llmEngine.abortWorkerInference(workerId);
  };

  const handleUnloadWorker = (workerId: string) => {
    llmEngine.unloadWorker(workerId);
    setWorkerIds((prevWorkerIds) =>
      prevWorkerIds.filter((id) => id !== workerId)
    );
  };

  return (
    <div className="flex flex-col min-h-screen">
      <div className="flex items-center justify-between p-4 bg-gray-100">
        <h1 className="text-2xl font-bold">LLM Testing</h1>
        <div className="flex items-center space-x-4">
          <span className="text-lg">
            Global Average TPS:{" "}
            <span className="font-bold">
              {(
                Object.values(workerStatus).reduce(
                  (sum, status) => sum + (status?.tps || 0),
                  0
                ) / Object.keys(workerStatus).length || 0
              ).toFixed(1) || "Nil"}
            </span>
          </span>
          <Textarea
            className="w-80"
            placeholder="Enter prompt..."
            value={globalPrompt}
            onChange={(e) => setGlobalPrompt(e.target.value)}
          />
          <Button onClick={handleGlobalInference}>Send to All</Button>
        </div>
        <Button
          onClick={() => setShowEngineLog(!showEngineLog)}
          variant="outline"
        >
          {showEngineLog ? "Hide Log" : "Show Log"}
        </Button>
      </div>
      <div className="flex-grow p-4">
        <div className="flex justify-end mb-4 items-center">
          <Select
            value={selectedModel}
            onValueChange={(value) =>
              setSelectedModel(value as (typeof availableModels)[number])
            }
          >
            <SelectTrigger className="w-70">
              <SelectValue placeholder="Select Model" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Models</SelectLabel>
                {availableModels.map((model) => (
                  <SelectItem key={model} value={model}>
                    {model}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <Button onClick={handleSpawnWorker} className="ml-4">
            Spawn Worker
          </Button>
          <span className="ml-6">Embedding Workers:</span>
          <div className="ml-4 flex items-center">
            <Button
              onClick={() =>
                setRequestedEmbeddingWorkerCount((prev) =>
                  Math.max(0, prev - 1)
                )
              }
              size="sm"
              className="w-8 p-0"
            >
              -
            </Button>
            <span className="mx-2">{embeddingWorkerCount}</span>
            <Button
              onClick={() =>
                setRequestedEmbeddingWorkerCount((prev) => prev + 1)
              }
              size="sm"
              className="w-8 p-0"
            >
              +
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {workerIds.map((workerId) => (
            <div
              key={workerId}
              className={`border border-gray-200 rounded-lg p-4 bg-white shadow ${
                modelColors[workerModels[workerId] as LLMModelName]
              }`}
            >
              <div className="flex justify-between items-center mb-2">
                <span className="text-lg font-semibold">
                  Worker: {workerId}
                </span>
                <span className="text-lg">
                  TPS:{" "}
                  <span className="font-bold">
                    {workerStatus[workerId]?.tps || 0}
                  </span>
                </span>
              </div>
              <p className="text-sm mb-2">Model: {workerModels[workerId]}</p>
              <Textarea
                className="w-full mb-2"
                rows={2}
                value={workerPrompts[workerId] || ""}
                onChange={(e) =>
                  setWorkerPrompts((prevPrompts) => ({
                    ...prevPrompts,
                    [workerId]: e.target.value,
                  }))
                }
              />
              <div className="relative mb-2 p-2 bg-gray-50 rounded text-sm max-h-20 overflow-auto">
                {workerStatus[workerId]?.state === "loading" && (
                  <Progress
                    value={workerStatus[workerId]?.loadingProgress || 0}
                    className="absolute top-0 left-0 w-full h-1"
                  />
                )}
                {workerStatus[workerId]?.state === "inference-in-progress" && (
                  <Progress
                    value={30}
                    className="absolute top-0 left-0 w-full h-1"
                  />
                )}
                <p className="whitespace-pre-line">
                  {workerStatus[workerId]?.output}
                </p>
              </div>
              <div className="mb-2">
                <span className="text-sm font-semibold">Embedding Hash:</span>{" "}
                <div className="text-xs font-bold uppercase overflow-x-scroll">
                  {workerStatus[workerId]?.embeddingHash}
                </div>
              </div>
              <div className="flex space-x-2 justify-center">
                <Button
                  size="sm"
                  onClick={() => handleWorkerInference(workerId)}
                  disabled={
                    workerStatus[workerId]?.state === "loading" ||
                    workerStatus[workerId]?.state === "inference-in-progress"
                  }
                >
                  Send
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleAbortInference(workerId)}
                  disabled={
                    workerStatus[workerId]?.state !== "inference-in-progress"
                  }
                >
                  Stop
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleUnloadWorker(workerId)}
                  disabled={
                    workerStatus[workerId]?.state === "loading" ||
                    workerStatus[workerId]?.state === "inference-in-progress"
                  }
                >
                  Unload
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div
        className={`fixed top-0 right-0 bottom-0 w-96 bg-white p-4 shadow-lg transition-transform duration-300 ease-in-out border-l border-gray-200 ${
          showEngineLog ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Engine Log</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowEngineLog(false)}
            className="p-0"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </Button>
        </div>
        <div className="space-y-2 overflow-auto max-h-[calc(100vh-8rem)]">
          {engineLog.map((entry, index) => (
            <Collapsible key={index} className="space-y-2">
              <div className="flex items-center justify-between space-x-4 px-4">
                <h4 className="text-sm font-semibold">{entry.type}</h4>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="w-9 p-0">
                    <ChevronsUpDown className="h-4 w-4" />
                    <span className="sr-only">Toggle</span>
                  </Button>
                </CollapsibleTrigger>
              </div>
              <CollapsibleContent>
                <pre className="rounded-md border px-4 py-3 font-mono text-sm overflow-auto">
                  <code className="language-json">
                    {JSON.stringify(entry, null, 2)}
                  </code>
                </pre>
              </CollapsibleContent>
            </Collapsible>
          ))}
        </div>
      </div>
      {allEmbeddingsSoFar.length >= 6 && (
        <EmbeddingChart embeddings={allEmbeddingsSoFar} />
      )}
    </div>
  );
};

export default LLMTestingPage;
