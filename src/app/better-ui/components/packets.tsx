import { Flex, TextField, Text, Card } from "@radix-ui/themes";
import usePackets from "../hooks/usePackets";
import { MagnifyingGlassIcon } from "@radix-ui/react-icons";

export default function Packets() {
  const packets = usePackets({ packetLimit: 500 });

  return (
    (packets && (
      <Flex direction="column" gap="4" py="4">
        <TextField.Root placeholder={`Search ${packets.total} packets...`}>
          <TextField.Slot>
            <MagnifyingGlassIcon height="16" width="16" />
          </TextField.Slot>
        </TextField.Root>
        {packets.packets.map((packet) => (
          <Card key={packet.signature + packet.synthientId}>
            <Text>{packet.packet.type}</Text>
          </Card>
        ))}
      </Flex>
    )) || <Text className="py-4">Waiting for network to load...</Text>
  );
}
