import { Box, Card, Flex, Select, Text } from "@radix-ui/themes";
import { useEffect, useState } from "react";
import {
  InMemoryLogs,
  StringLog,
} from "../../../rakis-core/synthient-chain/utils/logger";
import { InfoCircledIcon } from "@radix-ui/react-icons";
import { CircleX, ShieldAlert } from "lucide-react";
import TimeAgo from "javascript-time-ago";

// English.
import en from "javascript-time-ago/locale/en";

TimeAgo.addDefaultLocale(en);

// Create formatter (English).
const timeAgo = new TimeAgo("en-US");

export default function Logs() {
  const [logEntries, setLogEntries] = useState<StringLog[]>([]);

  useEffect(() => {
    setLogEntries(InMemoryLogs.getInstance().logs);

    const onNewLog = () => {
      setLogEntries(InMemoryLogs.getInstance().logs);
    };

    InMemoryLogs.getInstance().on("newLog", onNewLog);

    return () => {
      InMemoryLogs.getInstance().off("newLog", onNewLog);
    };
  }, []);

  return (
    <Flex direction="column" gap="5" py="4" px="2">
      <Flex gap="2">
        <label>
          <Text size="2" color="gray" mt="1">
            Showing
          </Text>
        </label>
        <Select.Root defaultValue="all">
          <Select.Trigger variant="soft" />
          <Select.Content>
            <Select.Group>
              <Select.Item value="all">All</Select.Item>
            </Select.Group>
            <Select.Group>
              {Array.from(new Set(logEntries.map((log) => log.logger))).map(
                (logger) => (
                  <Select.Item key={logger} value={logger}>
                    {logger}
                  </Select.Item>
                )
              )}
            </Select.Group>
          </Select.Content>
        </Select.Root>
        <Text size="2" color="gray" mt="1">
          logs of type
        </Text>
        <Select.Root defaultValue="all">
          <Select.Trigger variant="soft" />
          <Select.Content>
            <Select.Group>
              <Select.Item value="all">All</Select.Item>
            </Select.Group>
            <Select.Group>
              {Array.from(new Set(logEntries.map((log) => log.type))).map(
                (logType) => (
                  <Select.Item key={logType} value={logType}>
                    {logType.slice(0, 1).toUpperCase() + logType.slice(1)}
                  </Select.Item>
                )
              )}
            </Select.Group>
          </Select.Content>
        </Select.Root>
      </Flex>
      {logEntries.map((log) => (
        <Card
          variant="ghost"
          key={log.id}
          style={{
            borderBottom: "1px solid var(--gray-3)",
            ...(log.type === "warn"
              ? { backgroundColor: "var(--orange-5)" }
              : log.type === "error"
              ? { backgroundColor: "var(--red-5)" }
              : {}),
          }}
        >
          <Flex gap="2" align="center">
            <Box minWidth="10px" mr="2">
              {log.type === "debug" || log.type === "trace" ? (
                <InfoCircledIcon height="18" width="18" className="mb-4" />
              ) : log.type === "info" ? (
                <InfoCircledIcon height="18" width="18" className="mb-4" />
              ) : log.type === "warn" ? (
                <ShieldAlert height="18" width="18" className="mb-4" />
              ) : (
                <CircleX height="18" width="18" className="mb-4" />
              )}
            </Box>

            <Flex direction="column" flexGrow="1">
              <Text size="2">{log.message}</Text>
              <Flex justify="between" mt="1">
                <Text size="1" color="gray" weight="medium">
                  {log.logger}
                </Text>
                <Text size="1" color="gray">
                  {timeAgo.format(log.at)}
                </Text>
              </Flex>
            </Flex>
          </Flex>
        </Card>
      ))}
    </Flex>
  );
}
