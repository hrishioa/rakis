import { useEffect, useState } from "react";
import {
  availableModels,
  LLMModelName,
} from "../../rakis-core/synthient-chain/llm/types";
import {
  Button as RadixButton,
  Dialog,
  Flex,
  Text,
  TextField,
} from "@radix-ui/themes";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "../ui/command";
import { Button } from "../ui/button";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "../../lib/utils";

export default function ScaleWorkers({
  workerCount,
  scaleLLMWorkers,
}: {
  workerCount: { [modelName: string]: number };
  scaleLLMWorkers: (modelName: LLMModelName, workerCount: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState<LLMModelName | "">(
    "gemma-2b-it-q4f16_1"
  );
  const [scaleCount, setScaleCount] = useState("");

  useEffect(() => {
    setScaleCount(`${(selectedModel && workerCount[selectedModel] + 1) || 1}`);
  }, [selectedModel, workerCount]);

  function checkScaleWorkers() {
    if (
      selectedModel &&
      !isNaN(parseInt(scaleCount)) &&
      parseInt(scaleCount) >= 0
    ) {
      scaleLLMWorkers(selectedModel, parseInt(scaleCount));
      setDialogOpen(false);
    }
  }

  return (
    <Dialog.Root open={dialogOpen} onOpenChange={setDialogOpen}>
      <Dialog.Trigger>
        <RadixButton variant="soft" size="2">
          Scale Workers
        </RadixButton>
      </Dialog.Trigger>
      <Dialog.Content maxWidth="330px">
        <Flex direction="column">
          <label>
            <Text as="div" size="2" mb="1" weight="bold">
              Model Name
            </Text>
          </label>
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={open}
                className="w-[280px] justify-between"
              >
                {`${selectedModel.slice(0, 30)}${
                  selectedModel.length > 30 ? "..." : ""
                }` || "Select model..."}
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
          <label>
            <Text as="div" size="2" mt="4" mb="1" weight="bold">
              Number of Workers
            </Text>
          </label>
          <TextField.Root
            size="3"
            type="number"
            onChange={(e) => setScaleCount(e.target.value)}
            value={scaleCount}
            className="max-w-[280px]"
          />
          <RadixButton
            mt="4"
            variant="solid"
            color={
              selectedModel &&
              workerCount[selectedModel] &&
              !isNaN(parseInt(scaleCount))
                ? workerCount[selectedModel] < parseInt(scaleCount)
                  ? "green"
                  : "crimson"
                : "blue"
            }
            size="3"
            onClick={checkScaleWorkers}
            disabled={
              !!(
                selectedModel &&
                workerCount[selectedModel] &&
                !isNaN(parseInt(scaleCount)) &&
                workerCount[selectedModel] === parseInt(scaleCount)
              )
            }
          >
            {selectedModel &&
            workerCount[selectedModel] &&
            !isNaN(parseInt(scaleCount))
              ? workerCount[selectedModel] > parseInt(scaleCount)
                ? "Delete Workers"
                : "Add Workers"
              : "Scale Workers"}
          </RadixButton>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}
