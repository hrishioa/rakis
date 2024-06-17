import { Box, Card, Flex, Tabs, Text } from "@radix-ui/themes";
import Logs from "./logs";
import Packets from "./packets";
import usePackets from "../hooks/usePackets";

export default function LogsPackets({}) {
  const packets = usePackets({ packetLimit: 500 });

  return (
    <Flex direction="column" gap="2">
      <Text size="2" weight="medium" mt="3">
        Logs and Packets
      </Text>
      <Text size="1" color="gray">
        Packets you send and receive are here (just the latest few), along with
        your node&apos;s logs.
      </Text>
      <Box>
        <Card>
          <Tabs.Root defaultValue="logs">
            <Tabs.List>
              <Tabs.Trigger value="logs">Logs</Tabs.Trigger>
              <Tabs.Trigger value="packets">Packets</Tabs.Trigger>
            </Tabs.List>

            <Box maxHeight="300px" overflowY="scroll">
              <Tabs.Content value="logs">
                <Logs />
              </Tabs.Content>
              <Tabs.Content value="packets">
                <Packets />
              </Tabs.Content>
            </Box>
          </Tabs.Root>
        </Card>
      </Box>
    </Flex>
  );
}
