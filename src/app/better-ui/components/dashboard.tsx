"use client";

import Lottie from "react-lottie";
import { useTheDomain } from "../../../components/core/useTheDomain";
import * as sandwormAnimationData from "../../../components/core/sandworms.json";
import {
  Box,
  Button,
  Card,
  Flex,
  Tooltip,
  Text,
  Heading,
} from "@radix-ui/themes";
import { LLMModelName } from "../../../rakis-core/synthient-chain/llm/types";
import { useState } from "react";
import ChainIdentities from "./chainidentities";
import LLMWorkers from "./llmWorkers";
import ScaleWorkers from "./scaleWorkers";
import InferenceRequestForm from "./inferenceRequestForm";
import LogsPackets from "./logsPackets";
import Inferences from "./inferences";

export default function Dashboard({
  password,
  overwrite,
}: {
  password: string;
  overwrite: boolean;
}) {
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
  } = useTheDomain(password, overwrite);

  const [workerSelectOpen, setWorkerSelectOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState<LLMModelName | "">(
    "gemma-2b-it-q4f16_1"
  );
  const [numWorkers, setNumWorkers] = useState(1);
  const scaleWorkers = () => {
    if (selectedModel && !isNaN(numWorkers) && numWorkers > 0) {
      console.log(`Scaling ${numWorkers} workers for model ${selectedModel}`);
      if (selectedModel) scaleLLMWorkers(selectedModel, numWorkers);
    }
  };

  return (
    (mySynthientId && (
      <Flex
        direction="column"
        justify="start"
        gap="2"
        maxHeight={"100vh"}
        p="4"
        pl="5"
      >
        <Flex direction="row" justify="center" gap="2">
          <Tooltip content={`${mySynthientId}`}>
            <Button variant="ghost" size="3">
              You are {mySynthientId.slice(0, 10)}
            </Button>
          </Tooltip>
          <Box flexGrow="1"></Box>
          <ScaleWorkers
            workerCount={Object.keys(llmWorkerStates)
              .map((workerId) => llmWorkerStates[workerId].modelName)
              .reduce((acc, cur) => {
                acc[cur] ??= 0;
                acc[cur]++;
                return acc;
              }, {} as { [key: string]: number })}
            scaleLLMWorkers={scaleLLMWorkers}
          />
          <ChainIdentities
            chainIdentities={chainIdentities}
            synthientId={mySynthientId}
            addNewChainIdentity={addNewChainIdentity}
          />
        </Flex>
        <Flex direction="row" gap="4" justify="between">
          <Box>
            <InferenceRequestForm />
          </Box>
          <Box>
            <Flex direction="column" gap="2">
              <Text size="2" color="gray">
                Your stats
              </Text>
              <Flex direction="row" gap="2">
                <Box>
                  <Card>
                    <Heading size="7">200</Heading>
                    <Text size="2">Peers</Text>
                  </Card>
                </Box>
                <Box>
                  <Card>
                    <Heading size="8">20000+</Heading>
                    <Text size="2">Tokens</Text>
                  </Card>
                </Box>
                <Box>
                  <Card>
                    <Heading size="7">20000</Heading>
                    <Text size="2">Packets</Text>
                  </Card>
                </Box>
                <Box>
                  <Card>
                    <Heading size="7">7</Heading>
                    <Text size="2">Local Workers</Text>
                  </Card>
                </Box>
              </Flex>
            </Flex>
          </Box>
        </Flex>

        <LLMWorkers llmWorkerStates={llmWorkerStates} />
        <Flex gap="2">
          <LogsPackets />
          <Inferences />
        </Flex>
      </Flex>
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
}
