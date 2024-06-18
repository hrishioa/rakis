import { ChevronDown, CornerDownLeft } from "lucide-react";

import {
  Flex,
  Button,
  Text,
  TextField,
  Popover,
  CheckboxGroup,
  Tooltip,
} from "@radix-ui/themes";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  availableModels,
  LLMModelName,
} from "../../rakis-core/synthient-chain/llm/types";
import { useRef, useState } from "react";
import { useToast } from "../ui/use-toast";

export default function InferenceRequestForm({
  submitInferenceRequest,
}: {
  submitInferenceRequest: (
    prompt: string,
    models: LLMModelName[],
    minimumParticipants: number,
    timeAvailableSeconds: number,
    percentageAgreement: number
  ) => void;
}) {
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const [selectedModels, setSelectedModels] = useState<LLMModelName[]>([
    "gemma-2b-it-q4f16_1",
  ]);
  const [secPercentage, setSecPercentage] = useState("50");
  const [secDistance, setSecDistance] = useState("500");
  const [numNodes, setNumNodes] = useState("2");
  const [timeAvailable, setTimeAvailable] = useState("30");
  const { toast } = useToast();

  function validateAndSendInferenceRequest() {
    const params = {
      prompt: promptRef.current?.value,
      models: selectedModels,
      minimumParticipants: parseInt(numNodes),
      timeAvailableSeconds: parseInt(timeAvailable),
      percentageAgreement: parseInt(secPercentage),
    };

    if (!params.prompt) {
      toast({
        variant: "destructive",
        title: "Prompt is empty",
        description:
          "Please enter a prompt before sending an inference request.",
      });
      return;
    }

    if (params.models.length === 0) {
      toast({
        variant: "destructive",
        title: "No models selected",
        description:
          "Please select at least one model before sending an inference request.",
      });
      return;
    }

    if (isNaN(params.minimumParticipants) || params.minimumParticipants <= 0) {
      toast({
        variant: "destructive",
        title: "Invalid number of nodes",
        description:
          "Please enter a valid number of nodes before sending an inference request.",
      });
      return;
    }

    if (
      isNaN(params.timeAvailableSeconds) ||
      params.timeAvailableSeconds <= 0
    ) {
      toast({
        variant: "destructive",
        title: "Invalid expiry timeout",
        description:
          "Please enter a valid expiry timeout in seconds before sending an inference request.",
      });
      return;
    }

    if (
      isNaN(params.percentageAgreement) ||
      params.percentageAgreement <= 0 ||
      params.percentageAgreement > 100
    ) {
      toast({
        variant: "destructive",
        title: "Invalid consensus percentage",
        description:
          "Please enter a valid consensus percentage before sending an inference request.",
      });
      return;
    }

    submitInferenceRequest(
      params.prompt,
      params.models,
      params.minimumParticipants,
      params.timeAvailableSeconds,
      params.percentageAgreement
    );

    promptRef.current!.value = "";
  }

  return (
    <div className="relative overflow-hidden rounded-lg border bg-background focus-within:ring-2 focus-within:ring-ring ring-1">
      <Label htmlFor="prompt" className="sr-only">
        Prompt
      </Label>
      <Textarea
        id="prompt"
        autoFocus
        ref={promptRef}
        placeholder="Type your prompt for inference here..."
        className="min-h-24 resize-none border-0 p-3 shadow-none focus-visible:ring-0 text-md"
        onKeyDown={(e) => {
          if (e.key === "Enter" && e.metaKey) {
            validateAndSendInferenceRequest();
          }
        }}
      />
      <Flex justify={"center"} p="2" pt="0" gap="2">
        <Popover.Root>
          <Popover.Trigger>
            <Button variant="ghost" mt="2" size="2" color="gray" ml="3">
              Models <ChevronDown width={15} />
            </Button>
          </Popover.Trigger>
          <Popover.Content width="250px">
            <Flex direction="column" gap="2" p="3">
              <label>
                <Text as="div" size="2" mb="1" weight="bold" color="gray">
                  Which models are allowed?
                </Text>
              </label>
              <CheckboxGroup.Root
                defaultValue={selectedModels}
                name="selectedModels"
                onValueChange={(e) => setSelectedModels(e as LLMModelName[])}
              >
                {availableModels.map((model) => (
                  <CheckboxGroup.Item key={model} value={model}>
                    {model}
                  </CheckboxGroup.Item>
                ))}
              </CheckboxGroup.Root>
            </Flex>
          </Popover.Content>
        </Popover.Root>
        <Popover.Root>
          <Popover.Trigger>
            <Button variant="ghost" mt="2" size="2" color="gray" ml="3">
              Consensus <ChevronDown width={15} />
            </Button>
          </Popover.Trigger>
          <Popover.Content width="250px">
            <Flex direction="column" gap="2" p="3">
              <label>
                <Text as="div" size="2" mb="1" weight="bold" color="gray">
                  How many nodes should participate and how many should agree?
                </Text>
              </label>
              <Flex gap="2">
                <TextField.Root
                  placeholder="30"
                  size="2"
                  type="number"
                  className="max-w-14"
                  value={secPercentage}
                  onInput={(e) => setSecPercentage(e.currentTarget.value)}
                >
                  <TextField.Slot side="right">
                    <Text>%</Text>
                  </TextField.Slot>
                </TextField.Root>
                <Text size="2">of</Text>
                <TextField.Root
                  placeholder="6000"
                  size="2"
                  type="number"
                  value={numNodes}
                  onInput={(e) => setNumNodes(e.currentTarget.value)}
                >
                  <TextField.Slot side="right">
                    <Text>nodes</Text>
                  </TextField.Slot>
                </TextField.Root>
              </Flex>
              <label>
                <Text
                  as="div"
                  size="2"
                  mt="2"
                  mb="1"
                  weight="bold"
                  color="gray"
                >
                  How big should the consensus circle be? (Feel free to play
                  around with this!)
                </Text>
              </label>
              <TextField.Root
                placeholder="6000"
                size="2"
                type="number"
                value={secDistance}
                onInput={(e) => setSecDistance(e.currentTarget.value)}
              />
            </Flex>
          </Popover.Content>
        </Popover.Root>
        <Tooltip content="Maximum timeout for inferences to come in.">
          <TextField.Root
            placeholder="6000"
            ml="3"
            className="w-[5.3rem] flex-shrink mt-1"
            value={timeAvailable}
            onInput={(e) => setTimeAvailable(e.currentTarget.value)}
          >
            <TextField.Slot side="right">
              <Text>secs</Text>
            </TextField.Slot>
          </TextField.Root>
        </Tooltip>

        <Button
          type="submit"
          size="3"
          variant="solid"
          color="indigo"
          highContrast
          ml="auto"
          className="ml-auto gap-1.5 flex-grow"
          onClick={validateAndSendInferenceRequest}
        >
          Send to Rakis
          <CornerDownLeft className="size-3.5" />
        </Button>
      </Flex>
    </div>
  );
}
