import {
  Badge,
  Box,
  Card,
  Container,
  Flex,
  Separator,
  Text,
  Button,
  Popover,
  DataList,
  IconButton,
  Grid,
  Tooltip,
  ScrollArea,
} from "@radix-ui/themes";
import useInferences, {
  InferenceForDisplay,
  InferenceState,
} from "../hooks/useInferences";
import TimeAgo from "javascript-time-ago";
import { useThemeContext } from "@radix-ui/themes";

// English.
import { ChevronDown, CopyIcon } from "lucide-react";

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

function getInferenceStateDisplay(state: InferenceState) {
  if (state.state === "requested")
    return (
      <Box>
        <Text as="div" size="1" color="gray" mb="1">
          {state.at.toLocaleString()}
        </Text>
        <Text as="p" size="4">
          Requested {state.by ? `by ${state.by.slice(0, 5)}` : ""}
        </Text>
        <Text as="div" size="1" color="gray" mt="1">
          {state.endingAt > new Date()
            ? `ending in {(state.endingAt.getTime() - new Date().getTime()) / 1000} seconds`
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
        <Text as="p" size="4">
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
            ? `ending in {(state.endingAt.getTime() - new Date().getTime()) / 1000} seconds`
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
        <Text as="p" size="4">
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
            ? `ending in {(state.endingAt.getTime() - new Date().getTime()) / 1000} seconds`
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
        <Text as="p" size="4">
          Nodes are calculating consensus
        </Text>
        <Text as="div" size="1" color="gray" mt="1">
          {state.endingAt > new Date()
            ? `ending in {(state.endingAt.getTime() - new Date().getTime()) / 1000} seconds`
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
        <Text as="p" size="4">
          Collecting peer consensus
        </Text>
        {state.collectedExternalConsensuses > 0 && (
          <Text size="1" color="gray">
            {state.collectedExternalConsensuses} collected
          </Text>
        )}
        <Text as="div" size="1" color="gray" mt="1">
          {state.endingAt > new Date()
            ? `ending in {(state.endingAt.getTime() - new Date().getTime()) / 1000} seconds`
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
        <Tooltip content={state.finalOutput + " (click to copy)"}>
          <Flex direction="row" gap="2" ml="-5">
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
          Computed by {state.external ? "network" : "us"}
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

export default function Inferences() {
  const inferences = useInferences({ inferenceLimit: 5 });

  return (
    <Container size="2">
      <Card>
        <Flex gap="2" direction="column">
          {(inferences &&
            inferences.map((inference) => (
              <Inference key={inference.requestId} inference={inference} />
            ))) ||
            null}
        </Flex>
      </Card>
    </Container>
  );
}

export function Inference({ inference }: { inference: InferenceForDisplay }) {
  return (
    <Card>
      <Grid gap="2" columns="2" rows="1" height="125px">
        <Box width="300px" height="100%">
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
              {inference.quorum && <Badge>{inference.quorum.status}</Badge>}
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
            <Box pl="6">
              <Flex direction="column-reverse" gap="4">
                {inference.states.map((state, index) => (
                  <Box key={index}>
                    <GreenDot />
                    {getInferenceStateDisplay(state)}
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