import {
  Flex,
  Button,
  Box,
  Tooltip,
  Popover,
  Text,
  Card,
  Separator,
  Container,
  Heading,
  Link,
} from "@radix-ui/themes";
import { ChainIdentity } from "../../rakis-core/synthient-chain/db/entities";
import ChainIdentities from "./chainidentities";
import ScaleWorkers from "./scaleWorkers";
import {
  AvailableModel,
  LLMModelName,
  LLMWorkerStates,
} from "../../rakis-core/synthient-chain/llm/types";
import LiveHelp from "./livehelp";

const GreenDot = () => (
  <Box
    width="8px"
    height="8px"
    position="absolute"
    mt="3"
    ml="-1"
    left="0"
    style={{
      backgroundColor: "var(--teal-9)",
      borderRadius: "100%",
    }}
  />
);

export default function NavBar({
  llmWorkerStates,
  mySynthientId,
  scaleLLMWorkers,
  chainIdentities,
  addNewChainIdentity,
}: {
  llmWorkerStates: LLMWorkerStates;
  mySynthientId: string;
  scaleLLMWorkers: (modelName: LLMModelName, numWorkers: number) => void;
  chainIdentities: ChainIdentity[];
  addNewChainIdentity: (
    signature: `0x${string}`,
    chain: string,
    signedWithWallet: string
  ) => Promise<void>;
}) {
  const workerCount: Record<AvailableModel, number> = Object.keys(llmWorkerStates)
    .map((workerId) => llmWorkerStates[workerId].modelName as AvailableModel)
    .reduce((acc, cur) => {
      acc[cur] = (acc[cur] || 0) + 1;
      return acc;
  }, {} as Record<AvailableModel, number>);

  return (
    <Flex direction={{ initial: "column", sm: "row" }} justify="center" gap="2">
      <Tooltip content={`${mySynthientId}`}>
        <Button variant="ghost" size="3">
          You are {mySynthientId.slice(0, 10)}
        </Button>
      </Tooltip>
      <Box flexGrow="1"></Box>
      <Popover.Root>
        <Popover.Trigger>
          <Button variant="ghost" size="2">
            How Rakis Works
          </Button>
        </Popover.Trigger>
        <Popover.Content>
          <Card>
            <Text size="1">
              All Rakis nodes run the exact same code you are currently running,
              to process AI inference requests.{" "}
              <Link
                size="2"
                href="https://olickel.com/introducing-rakis"
                target="_blank"
              >
                Learn in more detail here
              </Link>
              . In short, here&apos;s how it works:
            </Text>
            <Container
              size="1"
              overflowY="scroll"
              pl="3"
              pt="3"
              style={{
                position: "relative",
              }}
            >
              <Box
                position="absolute"
                top="0"
                left="0"
                right="0"
                height="20px"
                style={{
                  pointerEvents: "none",
                  zIndex: 1,
                }}
              />
              <Box position="relative" pt="1">
                <Box
                  position="absolute"
                  top="0"
                  bottom="0"
                  width="1px"
                  ml="-0.5px"
                >
                  <Separator
                    size="4"
                    orientation="vertical"
                    mt="2"
                    style={
                      {
                        // background:
                        //   appearance === "dark"
                        //     ? ""
                        //     : "linear-gradient(to bottom, var(--teal-6) 90%, transparent)",
                      }
                    }
                  />
                </Box>
                <Box pl="6">
                  <Flex direction="column" gap="4">
                    <Box>
                      <GreenDot />
                      <Text size="3">
                        Inference requests are picked up from another node, or
                        from a supported blockchain contract (not fully
                        implemented yet).
                      </Text>
                    </Box>
                    <Box>
                      <GreenDot />
                      <Text size="3">
                        The Inference request contains a timeout until which
                        nodes can submit commitments, which are hashes that
                        commit them to a result without revealing it.
                      </Text>
                    </Box>
                    <Box>
                      <GreenDot />
                      <Text size="3">
                        At the end of the allotted time, if there are enough
                        commits (as specified by the request), nodes are
                        requested to reveal their results.
                      </Text>
                    </Box>
                    <Box>
                      <GreenDot />
                      <Text size="3">
                        Once results are revealed, all nodes double check the
                        embeddings and hashes to validate prior commitments.
                      </Text>
                    </Box>
                    <Box>
                      <GreenDot />
                      <Text size="3">
                        Among the validated commitments, the outputs are
                        clustered in embedding space, and the densest cluster of
                        results is chosen.
                      </Text>
                    </Box>
                    <Box>
                      <GreenDot />
                      <Text size="3">
                        Nodes communicate their independent results of
                        consensus, to check for agreement. This is the final
                        output you can see.
                      </Text>
                    </Box>
                  </Flex>
                </Box>
              </Box>
            </Container>
          </Card>
        </Popover.Content>
      </Popover.Root>
      <Box flexGrow="1"></Box>
      <LiveHelp />
      <ScaleWorkers
        workerCount={workerCount}
        scaleLLMWorkers={scaleLLMWorkers}
      />
      <ChainIdentities
        chainIdentities={chainIdentities}
        synthientId={mySynthientId}
        addNewChainIdentity={addNewChainIdentity}
      />
    </Flex>
  );
}
