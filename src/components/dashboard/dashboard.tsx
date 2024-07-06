"use client";

import Lottie from "react-lottie";
import { useTheDomain } from "../../hooks/useTheDomain";
import * as sandwormAnimationData from "./sandworms.json";
import { Box, Flex, Text } from "@radix-ui/themes";
import { useEffect, useState } from "react";
import InferenceRequestForm from "./inferenceRequestForm";
import LogsPackets from "./logsPackets";
import Inferences from "./inferences";
import NavBar from "./navbar";
import Stats from "./stats";
import { useWindowSize } from "@uidotdev/usehooks";
import LLMWorkers from "./llmWorkers";
import WatchChains from "./watchChains";

export default function Dashboard({
  password,
  overwrite,
}: {
  password: string;
  overwrite: boolean;
}) {
  const {
    llmWorkerStates,
    mySynthientId,
    scaleLLMWorkers,
    submitInferenceRequest,
    chainIdentities,
    addNewChainIdentity,
  } = useTheDomain(password, overwrite);

  const { width } = useWindowSize();

  const [narrowScreen, setNarrowScreen] = useState<boolean>(false);

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
          <Box minWidth="490px" maxWidth={{ initial: "unset", lg: "590px" }}>
            <Flex direction="row">
              <Flex direction="column" gap="2">
                <Flex
                  direction="column"
                  gap="2"
                  className="bg-lime-200 p-3"
                  style={{
                    borderRadius: "7px",
                  }}
                >
                  <Flex justify="between">
                    <Text size="5" weight="medium">
                      Run a prompt!
                    </Text>
                    <WatchChains />
                  </Flex>
                  <Text size="1" color="gray">
                    Send an inference request to the Rakis network from here.
                    Feel free to adjust the consensus settings to see what
                    succeeds and fails.
                  </Text>
                  <InferenceRequestForm
                    submitInferenceRequest={submitInferenceRequest}
                  />
                </Flex>
                <Stats />
                {narrowScreen ? null : <LogsPackets />}
              </Flex>
            </Flex>
          </Box>
          <Box flexGrow="1" minWidth="500px">
            {llmWorkerStates && Object.keys(llmWorkerStates).length ? (
              <Flex direction="column" gap="2">
                <LLMWorkers llmWorkerStates={llmWorkerStates} />
              </Flex>
            ) : null}
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
