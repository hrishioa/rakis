import { Flex, Card, Box, Heading, Text } from "@radix-ui/themes";

export default function Stats() {
  return (
    <Flex direction="row" gap="2">
      <Box>
        <Card>
          <Heading size="7">200</Heading>
          <Text size="2">Peers</Text>
        </Card>
      </Box>
      <Box>
        <Card>
          <Box>
            <Text as="span" size="7">
              20000
            </Text>
            <Text as="span" size="7" weight="bold">
              {" "}
              / 20000
            </Text>
          </Box>

          <Text size="2">Tokens (you/network)</Text>
        </Card>
      </Box>
      <Box>
        <Card>
          <Box>
            <Text as="span" size="7">
              7
            </Text>
            <Text as="span" size="7" weight="bold">
              {" "}
              / 300
            </Text>
          </Box>

          <Text size="2">AI Workers (you/network)</Text>
        </Card>
      </Box>{" "}
    </Flex>
  );
}
