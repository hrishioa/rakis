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
import { Progress } from "../../components/ui/progress";

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
    Record<string, { tps: number; output: string; isLoading: boolean }>
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
    setWorkerStatus((prevStatus) => ({
      ...prevStatus,
      [workerId]: { tps: 0, output: "", isLoading: true },
    }));
    await loadWorker(selectedModel, workerId);
    setWorkerIds((prevWorkerIds) => [...prevWorkerIds, workerId]);
    setWorkerModels((prevWorkerModels) => ({
      ...prevWorkerModels,
      [workerId]: selectedModel,
    }));
    setWorkerStatus((prevStatus) => ({
      ...prevStatus,
      [workerId]: { ...prevStatus[workerId], isLoading: false },
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
          [workerId]: {
            tps: tokensPerSecond,
            output: outputText,
            isLoading: false,
          },
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
                isLoading: true,
              },
            }));
          }
        }
        setWorkerStatus((prevStatus) => ({
          ...prevStatus,
          [workerId]: {
            ...prevStatus[workerId],
            isLoading: false,
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
      <div className="flex-grow p-8">
        <h1 className="text-4xl font-bold mb-8 text-center">LLM Testing</h1>
        <div className="mb-12">
          <h2 className="text-2xl font-bold mb-4 text-center">Spawn Worker</h2>
          <div className="flex justify-center space-x-4 items-center">
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
          {workerIds.map((workerId) => (
            <div
              key={workerId}
              className="border border-gray-200 rounded-lg p-6 bg-white shadow-md"
            >
              <h3 className="text-xl font-bold mb-4 text-center">
                Worker ID: {workerId}
              </h3>
              <p className="mb-2 text-lg">Model: {workerModels[workerId]}</p>
              <p className="mb-4 text-lg">
                Tokens per second:{" "}
                <span className="font-bold">
                  {workerStatus[workerId]?.tps || 0}
                </span>
              </p>
              <Textarea
                className="mb-4 text-lg"
                rows={4}
                value={workerPrompts[workerId] || ""}
                onChange={(e) =>
                  setWorkerPrompts((prevPrompts) => ({
                    ...prevPrompts,
                    [workerId]: e.target.value,
                  }))
                }
              />
              <div className="relative mb-4 p-4 bg-gray-50 rounded text-lg min-h-[6rem]">
                <div className="absolute inset-0 flex items-center justify-center">
                  {workerStatus[workerId]?.isLoading && (
                    <Progress value={30} className="w-[60%]" />
                  )}
                </div>
                <p className="whitespace-pre-line">
                  {workerStatus[workerId]?.output}
                </p>
              </div>
              <div className="flex space-x-4 justify-center">
                <Button
                  onClick={() => handleWorkerInference(workerId)}
                  disabled={workerStatus[workerId]?.isLoading}
                >
                  Send
                </Button>
                <Button
                  onClick={() => handleAbortInference(workerId)}
                  disabled={!workerStatus[workerId]?.isLoading}
                >
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
          <h2 className="text-2xl font-bold mb-4 text-center">
            Send to All Free Workers
          </h2>
          <div className="flex flex-col items-center space-y-4">
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
            <Textarea
              className="mb-2 w-full text-lg"
              rows={4}
              value={globalPrompt}
              onChange={(e) => setGlobalPrompt(e.target.value)}
            />
            <Button onClick={handleGlobalInference} className="w-64">
              Send
            </Button>
          </div>
          <p className="mt-4 text-center text-lg">
            Tokens per second:{" "}
            <span className="font-bold">
              {workerStatus["global"]?.tps || 0}
            </span>
          </p>
          <div className="mt-4 p-4 bg-gray-50 rounded text-lg min-h-[6rem]">
            <p className="whitespace-pre-line">
              {workerStatus["global"]?.output}
            </p>
          </div>
        </div>
      </div>
      <div
        className={`fixed top-0 right-0 bottom-0 w-96 bg-white p-8 shadow-lg transition-transform duration-300 ease-in-out ${
          showEngineLog ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <h2 className="text-xl font-bold mb-4">Engine Log</h2>
        <div className="p-2 bg-gray-50 rounded max-h-[calc(100vh-8rem)] overflow-auto">
          {engineLog.map((entry, index) => (
            <pre key={index} className="mb-2 text-sm">
              {JSON.stringify(entry, null, 2)}
            </pre>
          ))}
        </div>
      </div>
      <button
        className="fixed right-0 top-0 m-4 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded shadow-md"
        onClick={() => setShowEngineLog(!showEngineLog)}
      >
        {showEngineLog ? "Hide Log" : "Show Event Log"}
      </button>
    </div>
  );
};

export default LLMTestingPage;
