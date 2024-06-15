import { ChevronDown, CornerDownLeft } from "lucide-react";

import {
  Flex,
  Button,
  Text,
  TextField,
  TextArea,
  Popover,
  Heading,
  CheckboxGroup,
  Tooltip,
} from "@radix-ui/themes";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { availableModels } from "../../../rakis-core/synthient-chain/llm/types";

export default function InferenceRequestForm() {
  return (
    <div className="relative overflow-hidden rounded-lg border bg-background focus-within:ring-2 focus-within:ring-ring ring-1 max-w-[550px] min-w-[525px]">
      <Label htmlFor="message" className="sr-only">
        Message
      </Label>
      <Textarea
        id="message"
        placeholder="Type your message here..."
        className="min-h-24 resize-none border-0 p-3 shadow-none focus-visible:ring-0"
      />
      {/* <div className="flex items-center p-3 pt-0"> */}
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
              <CheckboxGroup.Root defaultValue={["1"]} name="example">
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
                >
                  <TextField.Slot side="right">
                    <Text>%</Text>
                  </TextField.Slot>
                </TextField.Root>
                <Text size="2">of</Text>
                <TextField.Root placeholder="6000" size="2" type="number">
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
              <TextField.Root placeholder="6000" size="2" type="number" />
            </Flex>
          </Popover.Content>
        </Popover.Root>
        <Tooltip content="Maximum timeout for inferences to come in.">
          <TextField.Root
            placeholder="6000"
            ml="3"
            className="w-[5.3rem] flex-shrink mt-1"
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
        >
          Send Inference Request
          <CornerDownLeft className="size-3.5" />
        </Button>
      </Flex>
    </div>
  );
}
