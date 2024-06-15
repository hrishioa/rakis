import { Box, Card, Tabs } from "@radix-ui/themes";
import Logs from "./logs";
import Packets from "./packets";
import usePackets from "../hooks/usePackets";

export default function LogsPackets({}) {
  const packets = usePackets({ packetLimit: 500 });

  return (
    <Box maxWidth="400px">
      <Card>
        <Tabs.Root defaultValue="logs">
          <Tabs.List>
            <Tabs.Trigger value="logs">Logs</Tabs.Trigger>
            <Tabs.Trigger value="packets">Packets</Tabs.Trigger>
          </Tabs.List>

          <Box maxHeight="500px" overflowY="scroll">
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
  );
}
