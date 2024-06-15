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
} from "@radix-ui/themes";
import useInferences, { InferenceForDisplay } from "../hooks/useInferences";
import TimeAgo from "javascript-time-ago";

// English.
import en from "javascript-time-ago/locale/en";
import { ChevronDown } from "lucide-react";

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

function getInferenceStates(inference: InferenceForDisplay) {
  const states: (
    | {
        state: "requested";
        at: Date;
        endingAt: Date;
        by: string;
      }
    | {
        state: "committing";
        at: Date;
        commitmentsCollected: number;
        commitmentsNeeded: number;
        endingAt: Date;
      }
    | {
        state: "revealRequested";
        at: Date;
        revealsCollected: number;
        commitments: number;
        endingAt: Date;
      }
    | {
        state: "calculatingConsensus";
        at: Date;
        endingAt: Date;
      }
    | {
        state: "collectingConsensus";
        at: Date;
        validCommitments: number;
        revealedCommitments: number;
        quorumThreshold: number;
        endingAt: Date;
      }
    | {
        state: "completed";
        finalOutput: string;
        validCommitments: number;
        revealedCommitments: number;
        quorumThreshold: number;
        bEmbeddingHash: number;
        consensusAgreedWith: number;
        consensusDisagreedWith: number;
      }
    | {
        state: "failed";
        reason:
          | "Not enough commitments"
          | "Not enough reveals"
          | "No consensus computed"
          | "Failed Quorum";
        at: Date;
      }
  )[] = [];

  states.push({
    state: "requested",
    at: new Date(inference.requestedAt),
    endingAt: inference.endingAt,
    by: inference.fromSynthientId || "unknown",
  });
}

export function Inference({ inference }: { inference: InferenceForDisplay }) {
  return (
    <Card>
      <Flex height="125px">
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
              <Text size="3" weight="medium">
                {inference.requestPayload.prompt}
              </Text>
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
          <Box
            position="absolute"
            bottom="0"
            left="0"
            right="0"
            height="20px"
            style={{
              background:
                "linear-gradient(to top, white, rgba(255, 255, 255, 0))",
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
                style={{
                  background:
                    "linear-gradient(to bottom, var(--teal-6) 90%, transparent)",
                }}
              />
            </Box>
            <Box pl="6">
              <Flex direction="column" gap="4">
                <Box>
                  <GreenDot />
                  <Text as="div" size="1" color="gray" mb="1">
                    July 1, 2023, 10:28 AM
                  </Text>
                  <Text as="p" size="2">
                    Package picked up from the warehouse in Phoenix, TX
                  </Text>
                </Box>
                <Box>
                  <GreenDot />
                  <Text as="div" size="1" color="gray" mb="1">
                    July 1, 2023, 12:43 PM
                  </Text>
                  <Text as="p" size="2">
                    Departed from Phoenix, TX
                  </Text>
                </Box>
                <Box>
                  <GreenDot />
                  <Text as="div" size="1" color="gray" mb="1">
                    July 2, 2023, 3:20 PM
                  </Text>
                  <Text as="p" size="2">
                    Arrived at a sorting facility in Seattle, WA
                  </Text>
                </Box>
                <Box>
                  <GreenDot />
                  <Text as="div" size="1" color="gray" mb="1">
                    July 2, 2023, 7:31 PM
                  </Text>
                  <Text as="p" size="2">
                    Departed Seattle, WA
                  </Text>
                </Box>
                <Box>
                  <GreenDot />
                  <Text as="div" size="1" color="gray" mb="1">
                    July 2, 2023, 11:03 PM
                  </Text>
                  <Text as="p" size="2">
                    Arrived to a facility in Greenville, WA
                  </Text>
                </Box>
              </Flex>
            </Box>
          </Box>
        </Container>
      </Flex>
    </Card>
  );
}
