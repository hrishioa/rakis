import React, { useState } from "react";
import InferenceList from "./inference-list";
import PacketCards from "./packet-cards";
import { useTheDomain } from "./useTheDomain";
import {
  LLMModelName,
  availableModels,
} from "../../rakis-core/synthient-chain/llm/types";
import Lottie from "react-lottie";
import * as sandwormAnimationData from "./sandworms.json";
import { cn } from "../../lib/utils";
import LLMWorkers from "./llmworkers";
import PeerTable from "./peertable";
import { Button } from "../ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "../ui/command";
import { MultiSelect } from "../ui/multi-select";
import { Check, ChevronsUpDown } from "lucide-react";
import { Label } from "../ui/label";
import { Input } from "../ui/input";
import ChainConnections from "./chain-connections";
import LogViewer from "./logviewer";

const Dashboard: React.FC<{
  identityPassword: string;
  overwriteIdentity: boolean;
}> = ({ identityPassword, overwriteIdentity }) => {
  const {
    peers,
    packets,
    llmEngineLog,
    llmWorkerStates,
    mySynthientId,
    scaleLLMWorkers,
    inferences,
    submitInferenceRequest,
    peerCount,
    chainIdentities,
    addNewChainIdentity,
  } = useTheDomain(identityPassword, overwriteIdentity);

  const [open, setOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState<LLMModelName | "">(
    "gemma-2b-it-q4f16_1"
  );
  const [numWorkers, setNumWorkers] = useState(1);

  const [prompt, setPrompt] = useState("");
  const [selectedModels, setSelectedModels] = useState<string[]>([
    "gemma-2b-it-q4f16_1",
  ]);
  const [minimumParticipants, setMinimumParticipants] = useState(2);
  const [timeAvailableSeconds, setTimeAvailableSeconds] = useState(20);
  const [percentageAgreement, setPercentageAgreement] = useState(50);

  const handleInferenceSubmit = () => {
    if (
      !prompt ||
      !selectedModels ||
      !selectedModels.length ||
      !minimumParticipants ||
      !timeAvailableSeconds ||
      !percentageAgreement
    )
      return;
    submitInferenceRequest(
      prompt,
      selectedModels as LLMModelName[],
      minimumParticipants,
      timeAvailableSeconds,
      percentageAgreement
    );

    setPrompt("");
  };

  const handleScale = () => {
    if (selectedModel) {
      console.log(`Scaling ${numWorkers} workers for model ${selectedModel}`);
      if (selectedModel) scaleLLMWorkers(selectedModel, numWorkers);
    }
  };

  return (
    (mySynthientId && (
      <div className="p-8 overflow-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex flex-col  mb-8">
            <h1 className="text-4xl font-bold mb-2">Started A Rakis</h1>
            <h2 className="text-sm font-bold">
              ID: {mySynthientId?.slice(0, 50)}...
            </h2>
          </div>
          <div className="flex flex-col space-y-4">
            <div className="flex flex-row items-center space-x-4">
              <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-[300px] justify-between"
                  >
                    {selectedModel || "Select model..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0 z-50">
                  <Command>
                    <CommandInput placeholder="Search model..." />
                    <CommandList>
                      <CommandEmpty>No model found.</CommandEmpty>
                      <CommandGroup>
                        {availableModels.map((model) => (
                          <CommandItem
                            key={model}
                            value={model}
                            onSelect={(currentValue) => {
                              setSelectedModel(
                                currentValue === selectedModel
                                  ? ""
                                  : (currentValue as LLMModelName)
                              );
                              setOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedModel === model
                                  ? "opacity-100"
                                  : "opacity-0"
                              )}
                            />
                            {model}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              <input
                type="number"
                min={1}
                value={numWorkers}
                onChange={(e) => {
                  if (!isNaN(parseInt(e.target.value)))
                    setNumWorkers(parseInt(e.target.value));
                }}
                className="w-20 px-2 py-1 border rounded-md"
              />
              <Button onClick={handleScale}>Scale Workers</Button>
            </div>
            <ChainConnections
              chainIdentities={chainIdentities}
              synthientId={mySynthientId}
              addNewChainIdentity={addNewChainIdentity}
            />
          </div>
        </div>

        <div className="mb-8 grid grid-cols-3 gap-8">
          {inferences && (
            <div className="bg-white rounded-lg shadow-lg p-6 col-span-1">
              <InferenceList inferences={inferences} />
            </div>
          )}
          <div className="ml-8 col-span-1">
            <h2 className="text-2xl font-bold mb-4">Inference Request</h2>
            <div className="mb-4">
              <Label htmlFor="prompt">Prompt</Label>
              <Input
                id="prompt"
                value={prompt}
                autoFocus
                onChange={(e: any) => setPrompt(e.target.value)}
                className="w-full"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleInferenceSubmit();
                }}
              />
            </div>
            <div className="mb-4">
              <Label>Models</Label>
              <MultiSelect
                options={availableModels.map((model) => ({
                  value: model,
                  label: model,
                }))}
                defaultValue={selectedModels}
                onValueChange={setSelectedModels}
                placeholder="Select models..."
                animation={2}
                maxCount={3}
                className="w-full"
              />
            </div>
            <div className="mb-4">
              <Label htmlFor="minimumParticipants">Minimum Participants</Label>
              <Input
                id="minimumParticipants"
                type="number"
                min={1}
                value={minimumParticipants}
                onChange={(e: any) =>
                  setMinimumParticipants(
                    isNaN(e.target.value) ? 1 : parseInt(e.target.value)
                  )
                }
                className="w-full"
              />
            </div>
            <div className="mb-4">
              <Label htmlFor="timeAvailableSeconds">
                Time Available (seconds)
              </Label>
              <Input
                id="timeAvailableSeconds"
                type="number"
                min={1}
                value={timeAvailableSeconds}
                onChange={(e: any) =>
                  setTimeAvailableSeconds(
                    isNaN(e.target.value) ? 10 : parseInt(e.target.value)
                  )
                }
                className="w-full"
              />
            </div>
            <div className="mb-4">
              <Label htmlFor="percentageAgreement">Percentage Agreement</Label>
              <Input
                id="percentageAgreement"
                type="number"
                min={0}
                max={100}
                value={percentageAgreement}
                onChange={(e: any) =>
                  setPercentageAgreement(parseInt(e.target.value))
                }
                className="w-full"
              />
            </div>
            <Button
              onClick={handleInferenceSubmit}
              className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded"
            >
              Send Inference Request
            </Button>
          </div>
          <div className="ml-8 col-span-1">
            <h2 className="text-2xl font-bold mb-4">Rakis Logs</h2>
            <LogViewer />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-[calc(100vh-10rem)] overflow-auto">
          <div className="lg:col-span-1">
            <LLMWorkers
              llmWorkerStates={llmWorkerStates}
              llmEngineLog={llmEngineLog}
            />
          </div>
          <div className="lg:col-span-1">
            {packets && (
              <div className="bg-white rounded-lg shadow-lg p-6 lg:h-[50vh]">
                <PacketCards packets={packets.packets} total={packets.total} />
              </div>
            )}
          </div>
          <div className="lg:col-span-1">
            {peers && <PeerTable peers={peers} peerCount={peerCount || 0} />}
          </div>
        </div>
      </div>
    )) || (
      <div className=" h-dvh w-full flex justify-center items-center">
        <div className="w-1/4">
          <Lottie
            options={{
              loop: true,
              autoplay: true,
              animationData: sandwormAnimationData,
              rendererSettings: {
                preserveAspectRatio: "xMidYMid slice",
              },
            }}
            style={{
              width: "100%",
              height: "auto",
            }}
          />
        </div>
      </div>
    )
  );
};

export default Dashboard;
