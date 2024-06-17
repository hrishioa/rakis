import { Box, Card, Flex, Text, Progress, Spinner } from "@radix-ui/themes";
import {
  LLMModelName,
  LLMWorkerStates,
} from "../../rakis-core/synthient-chain/llm/types";
import { BrainCircuit } from "lucide-react";
import { useState } from "react";

export default function LLMWorkers({
  llmWorkerStates,
}: {
  llmWorkerStates: LLMWorkerStates;
}) {
  const [open, setOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState<LLMModelName | "">(
    "gemma-2b-it-q4f16_1"
  );

  return (
    <Box p="2" my="3">
      <Flex direction="column">
        <Text size="5" weight="bold">
          Workers
        </Text>
        <Text size="2" color="gray">
          These are the local models you&apos;re running that will pick up
          inference requests from the network.
        </Text>
      </Flex>

      <Flex direction="row" overflowY={"scroll"}>
        {Object.keys(llmWorkerStates)
          .sort((a, b) => {
            if (
              llmWorkerStates[a].state === "idle" &&
              llmWorkerStates[b].state !== "idle"
            )
              return -1;
            if (
              llmWorkerStates[a].state !== "idle" &&
              llmWorkerStates[b].state === "idle"
            )
              return 1;
            return 0;
          })
          .map((workerId) => (
            <Card
              size="2"
              key={workerId}
              m="2"
              className="min-w-60"
              variant="surface"
            >
              <Flex gap="3" align="center">
                {llmWorkerStates[workerId].state === "inference-in-progress" ? (
                  <Spinner size="3" ml="2" />
                ) : (
                  <BrainCircuit width="20" height="20" className="ml-2" />
                )}
                <Box>
                  <Text as="div" size="2" weight="bold">
                    {llmWorkerStates[workerId].modelName.slice(0, 20)}
                    {llmWorkerStates[workerId].modelName.length > 20
                      ? "..."
                      : ""}
                  </Text>

                  {llmWorkerStates[workerId].loadingProgress < 1 ? (
                    <Progress
                      value={llmWorkerStates[workerId].loadingProgress * 100}
                      size="3"
                      mt="2"
                      variant="classic"
                    />
                  ) : (
                    <Text as="div" size="2" color="gray">
                      {llmWorkerStates[workerId].state}
                    </Text>
                  )}
                </Box>
              </Flex>
            </Card>
          ))}
      </Flex>
    </Box>
  );
}
