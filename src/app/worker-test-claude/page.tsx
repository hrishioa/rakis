"use client";

import React, { useEffect, useState } from "react";
import {
  loadWorker,
  runInference,
  runInferenceOnWorker,
  abortWorkerInference,
  unloadWorker,
  getEngineLogs,
} from "../../core/llm/llm-engine";
import {
  availableModels,
  LLMWorker,
  InferenceParams,
  LLMEngineLogEntry,
} from "../../core/llm/types";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { Button } from "../../components/ui/button";
import { Textarea } from "../../components/ui/textarea";

const LLMTestingPage: React.FC = () => {
  const [workerIds, setWorkerIds] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState<
    (typeof availableModels)[number]
  >(availableModels[0]);
  const [workerModels, setWorkerModels] = useState<Record<string, string>>({});
  const [workerPrompts, setWorkerPrompts] = useState<Record<string, string>>(
    {}
  );
  const [globalPrompt, setGlobalPrompt] = useState<string>("");
  const [engineLog, setEngineLog] = useState<LLMEngineLogEntry[]>([]);
  const [workerStatus, setWorkerStatus] = useState<
    Record<string, { tps: number; output: string }>
  >({});
  const [showEngineLog, setShowEngineLog] = useState(false);

  const pollEngineLogs = async () => {
    try {
      const newLogs = await getEngineLogs(20);
      if (newLogs.length > 0) {
        setEngineLog(newLogs);
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
    await loadWorker(selectedModel, workerId);
    setWorkerIds((prevWorkerIds) => [...prevWorkerIds, workerId]);
    setWorkerModels((prevWorkerModels) => ({
      ...prevWorkerModels,
      [workerId]: selectedModel,
    }));
  };

  const handleWorkerInference = async (workerId: string) => {
    const prompt = workerPrompts[workerId];
    const params: InferenceParams = {
      modelName: workerModels[workerId] as any,
      messages: [{ role: "user", content: prompt }],
    };
    const inferenceIterable = runInferenceOnWorker(params, workerId);
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
          [workerId]: { tps: tokensPerSecond, output: outputText },
        }));
      }
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
        const inferenceIterable = runInferenceOnWorker(params, workerId);
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
                isRunning: true,
              },
            }));
          }
        }

        setWorkerStatus((prevStatus) => ({
          ...prevStatus,
          [workerId]: {
            ...prevStatus[workerId],
            isRunning: false,
          },
        }));
      } catch (error) {
        console.error(`Error running inference on worker ${workerId}:`, error);
      }
    });

    await Promise.all(inferencePromises);
  };

  const handleAbortInference = (workerId: string) => {
    abortWorkerInference(workerId);
  };

  const handleUnloadWorker = (workerId: string) => {
    unloadWorker(workerId);
    setWorkerIds((prevWorkerIds) =>
      prevWorkerIds.filter((id) => id !== workerId)
    );
  };

  return (
    <div className="flex">
      <div className="flex-grow p-4">
        <h1 className="text-2xl font-bold mb-4">LLM Testing</h1>
        <div className="mb-8">
          <h2 className="text-xl font-bold mb-2">Spawn Worker</h2>
          <div className="flex items-center space-x-2">
            <Select
              value={selectedModel}
              onValueChange={(value) =>
                setSelectedModel(value as (typeof availableModels)[number])
              }
            >
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Select a model" />
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
            <Button onClick={handleSpawnWorker}>Spawn Worker</Button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 mb-8">
          {workerIds.map((workerId) => (
            <div
              key={workerId}
              className="border border-gray-300 rounded-lg p-4 text-sm"
            >
              <h3 className="text-base font-bold mb-2">
                Worker ID: {workerId}
              </h3>
              <p className="mb-2">Model: {workerModels[workerId]}</p>
              <p className="mb-2">
                Tokens per second: {workerStatus[workerId]?.tps || 0}
              </p>
              <Textarea
                className="mb-2"
                value={workerPrompts[workerId] || ""}
                onChange={(e) =>
                  setWorkerPrompts((prevPrompts) => ({
                    ...prevPrompts,
                    [workerId]: e.target.value,
                  }))
                }
              />
              <div className="whitespace-pre-line text-sm mt-2 p-2 bg-gray-100 rounded">
                {workerStatus[workerId]?.output}
              </div>
              <div className="flex space-x-2 mt-2">
                <Button onClick={() => handleWorkerInference(workerId)}>
                  Send
                </Button>
                <Button onClick={() => handleAbortInference(workerId)}>
                  Stop
                </Button>
                <Button onClick={() => handleUnloadWorker(workerId)}>
                  Unload
                </Button>
              </div>
            </div>
          ))}
        </div>
        <div className="mb-8">
          <h2 className="text-xl font-bold mb-2">Send to All Free Workers</h2>
          <div className="flex items-center space-x-2 mb-2">
            <Select
              value={selectedModel}
              onValueChange={(value) =>
                setSelectedModel(value as (typeof availableModels)[number])
              }
            >
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Select a model" />
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
            <Button onClick={handleGlobalInference}>Send</Button>
          </div>
          <Textarea
            className="mb-2"
            value={globalPrompt}
            onChange={(e) => setGlobalPrompt(e.target.value)}
          />
          <p className="mb-2">
            Tokens per second: {workerStatus["global"]?.tps || 0}
          </p>
          <pre className="p-2 bg-gray-100 rounded">
            {workerStatus["global"]?.output}
          </pre>
        </div>
      </div>
      {showEngineLog && (
        <div className="w-128 bg-gray-100 p-4 overflow-y-auto">
          <h2 className="text-xl font-bold mb-2">Engine Log</h2>
          <div className="p-2 bg-white rounded">
            {engineLog.map((entry, index) => (
              <pre key={index} className="mb-2">
                {JSON.stringify(entry, null, 2)}
              </pre>
            ))}
          </div>
        </div>
      )}
      <button
        className="fixed right-0 top-0 m-4 p-2 bg-gray-200 rounded"
        onClick={() => setShowEngineLog(!showEngineLog)}
      >
        {showEngineLog ? "Hide Log" : "Show Log"}
      </button>
    </div>
  );
};

export default LLMTestingPage;
