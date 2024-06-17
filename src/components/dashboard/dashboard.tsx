"use client";

import Lottie from "react-lottie";
import { useTheDomain } from "../../hooks/useTheDomain";
import * as sandwormAnimationData from "./sandworms.json";
import { Box, Flex, Text } from "@radix-ui/themes";
import { LLMModelName } from "../../rakis-core/synthient-chain/llm/types";
import { useEffect, useState } from "react";
import InferenceRequestForm from "./inferenceRequestForm";
import LogsPackets from "./logsPackets";
import Inferences from "./inferences";
import NavBar from "./navbar";
import Stats from "./stats";
import { useWindowSize } from "@uidotdev/usehooks";

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

  const { width, height } = useWindowSize();

  const [workerSelectOpen, setWorkerSelectOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState<LLMModelName | "">(
    "gemma-2b-it-q4f16_1"
  );
  const [narrowScreen, setNarrowScreen] = useState<boolean>(false);
  const [numWorkers, setNumWorkers] = useState(1);
  const scaleWorkers = () => {
    if (selectedModel && !isNaN(numWorkers) && numWorkers > 0) {
      console.log(`Scaling ${numWorkers} workers for model ${selectedModel}`);
      if (selectedModel) scaleLLMWorkers(selectedModel, numWorkers);
    }
  };

  useEffect(() => {
    if (width) {
      if (width < 1280) setNarrowScreen(true);
      else setNarrowScreen(false);
    }
  }, [width]);

  return (
    (mySynthientId && (
      <Flex
        direction="column"
        justify="start"
        gap="2"
        height="100vh"
        p="4"
        className="w-full"
      >
        <Box mt="1">
          <NavBar
            llmWorkerStates={llmWorkerStates}
            mySynthientId={mySynthientId}
            scaleLLMWorkers={scaleLLMWorkers}
            chainIdentities={chainIdentities}
            addNewChainIdentity={addNewChainIdentity}
          />
        </Box>

        <Flex direction={{ initial: "column", lg: "row" }} gap="4">
          <Box minWidth="490px" maxWidth={{ initial: "unset", lg: "550px" }}>
            <Flex direction="row">
              <Flex direction="column" gap="2">
                <Text size="2" weight="medium">
                  Start here: Run a prompt!
                </Text>
                <Text size="1" color="gray">
                  Send an inference request to the Rakis network from here. Feel
                  free to adjust the consensus settings to see what succeeds and
                  fails.
                </Text>
                <InferenceRequestForm
                  submitInferenceRequest={submitInferenceRequest}
                />
                <Text size="2" weight="medium" mt="3">
                  Your Stats
                </Text>
                <Text size="1" color="gray">
                  Rakis has no central servers, so these stats are collected
                  from p2p exchanges during your time in the network. YMMV!
                </Text>
                <Stats />
                {narrowScreen ? null : <LogsPackets />}
              </Flex>
            </Flex>
          </Box>
          <Box flexGrow="1" minWidth="500px">
            <Flex direction="column" gap="2">
              <Text size="2" weight="medium">
                Step two: watch inferences
              </Text>
              <Text size="1" color="gray">
                Rakis is completely public. Watch inference requests from the
                networks here, as they pass through each stage of validation.
              </Text>
              <Inferences mySynthientId={mySynthientId} />
            </Flex>
          </Box>
          {narrowScreen ? <LogsPackets /> : null}
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
