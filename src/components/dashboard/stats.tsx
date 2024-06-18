import { Flex, Card, Box, Heading, Text } from "@radix-ui/themes";
import useStats from "../../hooks/useStats";

export default function Stats() {
  const stats = useStats(7);

  function getShorterNum(num: number) {
    if (isNaN(num)) return "-";
    if (num > 1000000000) return `${(num / 1000000000).toFixed(1)}B`;
    if (num > 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    } else if (num > 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    } else {
      return num;
    }
  }

  return (
    (stats && (
      <Flex direction="column" gap="2">
        <Text size="2" weight="medium" mt="3">
          Your Stats
        </Text>
        <Text size="1" color="gray">
          Rakis has no central servers, so these stats are collected from p2p
          exchanges during your time in the network. YMMV!
        </Text>
        <Flex direction="row" gap="2">
          <Box>
            <Card>
              <Heading size="7">
                {getShorterNum(stats.peerStats.totalPeers)}
              </Heading>
              <Text size="2">Peers</Text>
            </Card>
          </Box>
          <Box>
            <Card>
              <Box>
                <Text as="span" size="7">
                  {getShorterNum(stats.ourStats.tokens)}
                </Text>
                <Text as="span" size="7" weight="bold">
                  {" "}
                  /{" "}
                  {getShorterNum(
                    stats.peerStats.totalTokens + stats.ourStats.tokens
                  )}
                </Text>
              </Box>

              <Text size="2">Tokens (you/network)</Text>
            </Card>
          </Box>
          <Box>
            <Card>
              <Box>
                <Text as="span" size="7">
                  {getShorterNum(stats.ourStats.workers)}
                </Text>
                <Text as="span" size="7" weight="bold">
                  {" "}
                  /{" "}
                  {getShorterNum(
                    stats.peerStats.totalWorkers + stats.ourStats.workers
                  )}
                </Text>
              </Box>

              <Text size="2">AI Workers (you/network)</Text>
            </Card>
          </Box>{" "}
        </Flex>
      </Flex>
    )) ||
    null
  );
}
