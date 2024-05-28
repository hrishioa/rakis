"use client";

import { useState } from "react";
import { Button } from "../../components/ui/button";
import { Checkbox } from "../../components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import LLMWorkerComponent from "./LLMWorkerComponent";
import { availableModels } from "../../core/llm/types";

export default function Home() {
  const [workersCount, setWorkersCount] = useState(0);
  const [selectedModel, setSelectedModel] = useState<string>(
    availableModels[0]
  );
  const [isSynced, setIsSynced] = useState(false);
  const [sharedMessage, setSharedMessage] = useState("");

  const addLLMWorker = () => {
    setWorkersCount((prevCount) => prevCount + 1);
  };

  const handleMessageChange = (index: number, message: string) => {
    if (isSynced) {
      setSharedMessage(message);
    }
  };

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-3xl font-bold mb-6">LLM Workers</h1>
      <div className="mb-6 flex items-center space-x-4">
        <Select value={selectedModel} onValueChange={setSelectedModel}>
          <SelectTrigger className="w-[280px]">
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
        <Button onClick={addLLMWorker} className="ml-2">
          Add Worker
        </Button>
      </div>
      <div className="flex items-center space-x-2 mb-6">
        <Checkbox
          id="syncCheckbox"
          checked={isSynced}
          onCheckedChange={(checked) => setIsSynced(checked === true)}
        />
        <label
          htmlFor="syncCheckbox"
          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
        >
          Sync Textboxes
        </label>
      </div>
      {Array.from({ length: workersCount }).map((_, index) => (
        <LLMWorkerComponent
          key={index}
          workerIndex={index}
          selectedModel={selectedModel as (typeof availableModels)[number]}
        />
      ))}
    </div>
  );
}
