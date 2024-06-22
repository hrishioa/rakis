import {
  Box,
  Card,
  Container,
  Flex,
  Text,
  Button,
  Popover,
  DataList,
  IconButton,
  Grid,
  Tooltip,
  Separator,
} from "@radix-ui/themes";
import useInferences, {
  InferenceForDisplay,
  InferenceState,
} from "../../hooks/useInferences";
import TimeAgo from "javascript-time-ago";

// English.
import { ChevronDown, CopyIcon } from "lucide-react";

// English.
import en from "javascript-time-ago/locale/en";
import { useToast } from "../ui/use-toast";

TimeAgo.addDefaultLocale(en);

// Create formatter (English).
const timeAgo = new TimeAgo("en-US");

const GreenDot = () => (
  <Box
    width="8px"
    height="8px"
    position="absolute"
    mt="1"
    ml="-1"
    left="0"
    style={{
      backgroundColor: "var(--teal-9)",
      borderRadius: "100%",
    }}
  />
);

function getInferenceStateDisplay(
  state: InferenceState,
  mySynthientId: string,
  toast: ReturnType<typeof useToast>["toast"]
) {
  if (state.state === "requested")
    return (
      <Box>
        <Text as="div" size="1" color="gray" mb="1">
          {state.at.toLocaleString()}
        </Text>
        <Text as="p" size="3">
          Requested{" "}
          {state.by
            ? `by ${
                state.by === mySynthientId ? "this node" : state.by.slice(0, 5)
              }`
            : ""}
        </Text>
        <Text as="div" size="1" color="gray" mt="1">
          {state.endingAt > new Date()
            ? `ending in ${(
                (state.endingAt.getTime() - new Date().getTime()) /
                1000
              ).toFixed(1)} seconds`
            : `ended at ${state.endingAt.toLocaleString()}`}
        </Text>
      </Box>
    );

  if (state.state === "committing")
    return (
      <Box>
        <Text as="div" size="1" color="gray" mb="1">
          {state.at.toLocaleString()}
        </Text>
        <Text as="p" size="3">
          Collecting Inferences
        </Text>
        <Text
          size="2"
          weight="bold"
          color={
            state.commitmentsCollected >= state.commitmentsNeeded
              ? "grass"
              : "amber"
          }
        >
          {state.commitmentsCollected} of {state.commitmentsNeeded} needed
        </Text>
        <Text as="div" size="1" color="gray" mt="1">
          {state.endingAt > new Date()
            ? `ending in ${(
                (state.endingAt.getTime() - new Date().getTime()) /
                1000
              ).toFixed(1)} seconds`
            : `ended at ${state.endingAt.toLocaleString()}`}
        </Text>
      </Box>
    );

  if (state.state === "revealRequested")
    return (
      <Box>
        <Text as="div" size="1" color="gray" mb="1">
          {state.at.toLocaleString()}
        </Text>
        <Text as="p" size="3">
          Requesting Nodes to reveal
        </Text>
        <Text
          size="2"
          weight="bold"
          color={
            state.revealsCollected >= state.revealsNeeded ? "grass" : "amber"
          }
        >
          {state.revealsCollected} of {state.commitments} revealed
        </Text>
        <Text as="div" size="1" color="gray" mt="1">
          {state.endingAt > new Date()
            ? `ending in ${(
                (state.endingAt.getTime() - new Date().getTime()) /
                1000
              ).toFixed(1)} seconds`
            : `ended at ${state.endingAt.toLocaleString()}`}
        </Text>
      </Box>
    );

  if (state.state === "calculatingConsensus")
    return (
      <Box>
        <Text as="div" size="1" color="gray" mb="1">
          {state.at.toLocaleString()}
        </Text>
        <Text as="p" size="3">
          Nodes are calculating consensus
        </Text>
        <Text as="div" size="1" color="gray" mt="1">
          {state.endingAt > new Date()
            ? `ending in ${(
                (state.endingAt.getTime() - new Date().getTime()) /
                1000
              ).toFixed(1)} seconds`
            : `ended at ${state.endingAt.toLocaleString()}`}
        </Text>
      </Box>
    );

  if (state.state === "collectingExternalConsensuses")
    return (
      <Box>
        <Text as="div" size="1" color="gray" mb="1">
          {state.at.toLocaleString()}
        </Text>
        <Text as="p" size="3">
          Collecting peer consensus
        </Text>
        {state.collectedExternalConsensuses > 0 && (
          <Text size="1" color="gray">
            {state.collectedExternalConsensuses} collected
          </Text>
        )}
        <Text as="div" size="1" color="gray" mt="1">
          {state.endingAt > new Date()
            ? `ending in ${(
                (state.endingAt.getTime() - new Date().getTime()) /
                1000
              ).toFixed(1)} seconds`
            : `ended at ${state.endingAt.toLocaleString()}`}
        </Text>
      </Box>
    );

  if (state.state === "completed")
    return (
      <Box>
        <Text as="div" size="1" color="gray" mb="1">
          {state.at.toLocaleString()}
        </Text>
        <Text as="p" size="1">
          Verified inference:
        </Text>
        <Tooltip content={state.finalOutput + " (click to copy)"}>
          <Flex
            direction="row"
            gap="2"
            ml="-5"
            onClick={() => {
              navigator.clipboard.writeText(state.finalOutput);
              toast({
                title: "Copied to clipboard",
              });
            }}
          >
            <IconButton
              size="1"
              aria-label="Copy value"
              color="gray"
              variant="ghost"
            >
              <CopyIcon width="15" />
            </IconButton>
            <Text as="p" size="3" weight="medium" wrap="wrap" color="green">
              {state.finalOutput.slice(0, 100)}...
            </Text>
          </Flex>
        </Tooltip>
        <Text as="p" size="1" mt="2">
          {state.validCommitments}/{state.revealedCommitments} reveals judged
          valid
        </Text>
        <Text as="p" size="1" color="gray" mt="2">
          Computed by {state.external ? "network" : "this node"}
        </Text>
        <Text as="p" size="1" color="gray" mt="1">
          {state.bEmbeddingHash.slice(0, 25)}...
        </Text>
        <Text as="p" size="1" color="gray" mt="1">
          {state.consensusAgreedWith} agree, {state.consensusDisagreedWith}{" "}
          disagree
        </Text>
      </Box>
    );

  if (state.state === "failed")
    return (
      <Box>
        <Text as="div" size="1" color="gray" mb="1">
          {state.at.toLocaleString()}
        </Text>
        <Text as="p" size="4" weight="medium" color="ruby">
          Failed
        </Text>
        <Text mt="1" size="2">
          {state.reason}
        </Text>
      </Box>
    );
}

export function Inference({
  inference,
  mySynthientId,
}: {
  inference: InferenceForDisplay;
  mySynthientId: string;
}) {
  const { toast } = useToast();

  return (
    <Card>
      <Grid gap="2" columns="2" rows="1" height="125px">
        <Box height="100%">
          <Flex direction="column" gap="1" className="h-full">
            <Flex justify="between" mx="1">
              <Popover.Root>
                <Popover.Trigger>
                  <Button
                    size="1"
                    variant="ghost"
                    color="gray"
                    style={{
                      padding: "0 5px",
                    }}
                  >
                    Parameters <ChevronDown width={15} />
                  </Button>
                </Popover.Trigger>
                <Popover.Content
                  width="450px"
                  style={{
                    padding: "20px 30px",
                  }}
                >
                  <DataList.Root>
                    <DataList.Item>
                      <DataList.Label minWidth="88px">
                        Request Id
                      </DataList.Label>
                      <DataList.Value>{inference.requestId}</DataList.Value>
                    </DataList.Item>
                    <DataList.Item>
                      <DataList.Label minWidth="88px">
                        Accepted Models
                      </DataList.Label>
                      <DataList.Value>
                        ({inference.requestPayload.acceptedModels.length}){" "}
                        {inference.requestPayload.acceptedModels
                          .join(", ")
                          .slice(0, 100)}
                      </DataList.Value>
                    </DataList.Item>
                    <DataList.Item>
                      <DataList.Label minWidth="88px">
                        Embedding Model
                      </DataList.Label>
                      <DataList.Value>
                        {inference.requestPayload.securityFrame.embeddingModel}
                      </DataList.Value>
                    </DataList.Item>
                    <DataList.Item>
                      <DataList.Label minWidth="88px">
                        Security Distance
                      </DataList.Label>
                      <DataList.Value>
                        {inference.requestPayload.securityFrame.secDistance}{" "}
                        distance in embedding space
                      </DataList.Value>
                    </DataList.Item>
                  </DataList.Root>
                </Popover.Content>
              </Popover.Root>
              {/* {inference.quorum && <Badge>{inference.quorum.status}</Badge>} */}
            </Flex>

            <Box className="flex-grow" mt="1">
              <Tooltip content={inference.requestPayload.prompt}>
                <Text size="3" weight="medium">
                  {inference.requestPayload.prompt.slice(0, 60)}
                  {inference.requestPayload.prompt.length > 60 ? "..." : ""}
                </Text>
              </Tooltip>
            </Box>
            <Text
              size="1"
              color={
                inference.quorum &&
                inference.quorum.quorumCommitted >=
                  inference.quorum.quorumThreshold
                  ? "grass"
                  : "amber"
              }
              align="right"
              mt="1"
            >
              {Math.floor(
                inference.requestPayload.securityFrame.quorum *
                  inference.requestPayload.securityFrame.secPercentage
              )}
              /{inference.requestPayload.securityFrame.quorum} nodes need to
              agree
            </Text>
            <Text size="1" color="gray" align="right">
              {`from ${
                inference.fromSynthientId
                  ? `${inference.fromSynthientId.slice(0, 5)}...`
                  : "unknown"
              } (on ${inference.requestPayload.fromChain})`}{" "}
              {timeAgo.format(new Date(inference.requestedAt))}
            </Text>
          </Flex>
        </Box>
        <Container
          size="1"
          overflowY="scroll"
          pl="3"
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
            <Box position="absolute" top="0" bottom="0" width="1px" ml="-0.5px">
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
              <Flex direction="column-reverse" gap="4">
                {inference.states.map((state, index) => (
                  <Box key={index}>
                    <GreenDot />
                    {getInferenceStateDisplay(state, mySynthientId, toast)}
                  </Box>
                ))}
              </Flex>
            </Box>
          </Box>
        </Container>
      </Grid>
    </Card>
  );
}

export default function Inferences({
  mySynthientId,
}: {
  mySynthientId: string;
}) {
  const inferences = useInferences({ inferenceLimit: 50 });

  // TODO: Allow clicking each inference to show the full inference data as a datalist (all commit data, etc etc)

  return (
    <Card>
      <Container
        // size="2"
        maxHeight={{ initial: "50vh", lg: "65vh" }}
        overflowY="scroll"
      >
        <Flex gap="2" direction="column">
          {(inferences &&
            inferences.length &&
            inferences.map((inference) => (
              <Inference
                key={inference.requestId}
                inference={inference}
                mySynthientId={mySynthientId}
              />
            ))) || (
            <Flex gap="2" direction="column">
              <Text size="4" weight="bold">
                No Inferences yet
              </Text>
              <Text size="2">
                Inferences on Rakis are ephemeral - you only see the ones that
                happen after you node has been live. Leave your node running or
                send an inference to see them here.
              </Text>
            </Flex>
          )}
        </Flex>
      </Container>
    </Card>
  );
}
