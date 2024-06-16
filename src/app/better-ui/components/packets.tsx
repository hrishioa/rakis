import { Flex, TextField, Text, Card, Spinner } from "@radix-ui/themes";
import usePackets from "../hooks/usePackets";
import { MagnifyingGlassIcon } from "@radix-ui/react-icons";
import { useDebounce } from "@uidotdev/usehooks";

import TimeAgo from "javascript-time-ago";
import { ReceivedPeerPacket } from "../../../rakis-core/synthient-chain/db/packet-types";
import {
  Activity,
  CheckCircle,
  Crosshair,
  Info,
  Search,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";

// Create formatter (English).
const timeAgo = new TimeAgo("en-US");

const getStatusColor = (status: string) => {
  switch (status) {
    case "loaded_worker":
    case "inferencing":
    case "completed_inference":
      return "blue";
    case "computing_bEmbeddingHash":
    case "verifying quorum":
      return "orange";
    default:
      return "gray";
  }
};

const capitalizeWords = (str: string) => {
  return str
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

const getPacketIcon = (type: string) => {
  switch (type) {
    case "peerStatusUpdate":
      return <Activity size={20} />;
    case "knownPeers":
      return <Users size={20} />;
    case "peerHeart":
      return <Crosshair size={20} />;
    case "peerInfo":
      return <Info size={20} />;
    case "peerConnectedChain":
      return <CheckCircle size={20} />;
    case "inferenceCommit":
    case "inferenceRevealRequest":
    case "inferenceReveal":
    case "inferenceRevealRejected":
    case "inferenceQuorumComputed":
    case "p2pInferenceRequest":
      return <Search size={20} />;
    default:
      return null;
  }
};

const getPacketMeta = (packet: ReceivedPeerPacket) => {
  switch (packet.packet.type) {
    case "peerStatusUpdate":
      return (
        <Flex direction="column">
          <Text size="3" color={getStatusColor(packet.packet.status)}>
            {capitalizeWords(packet.packet.status)}
          </Text>
          {packet.packet.status === "loaded_worker" && (
            <Text size="1" color="gray">
              Model: {packet.packet.modelName}
            </Text>
          )}
          {packet.packet.status === "inferencing" && (
            <Text size="1" color="gray">
              Model: {packet.packet.modelName}
            </Text>
          )}
          {packet.packet.status === "completed_inference" && (
            <>
              <Text size="1" color="gray">
                Model: {packet.packet.modelName}
              </Text>
              <Text size="1" color="gray">
                TPS: {packet.packet.tps}
              </Text>
            </>
          )}
          {packet.packet.status === "computing_bEmbeddingHash" && (
            <Text size="1" color="gray">
              Embedding Models: {packet.packet.embeddingModels.join(", ")}
            </Text>
          )}
          {packet.packet.status === "verifying quorum" && (
            <Text size="1" color="gray">
              Request ID: {packet.packet.requestId}
            </Text>
          )}
        </Flex>
      );
    case "knownPeers":
      return (
        <Flex direction="column">
          <Text size="3" color="blue">
            Known Peers
          </Text>
          <Text size="1" color="gray">
            {packet.packet.peerList.length} peers
          </Text>
        </Flex>
      );
    case "peerHeart":
      return (
        <Flex direction="column">
          <Text size="3" color="green">
            Peer Heartbeat
          </Text>
          <Text size="1" color="gray">
            Window X: {packet.packet.windowX}
          </Text>
          <Text size="1" color="gray">
            Window Y: {packet.packet.windowY}
          </Text>
        </Flex>
      );
    case "peerInfo":
      return (
        <Flex direction="column">
          <Text size="3" color="blue">
            Peer Info
          </Text>
          <Text size="1" color="gray">
            Device Info: {packet.packet.deviceInfo}
          </Text>
        </Flex>
      );
    case "peerConnectedChain":
      return (
        <Flex direction="column">
          <Text size="3" color="green">
            Connected Chains
          </Text>
          <Text size="1" color="gray">
            {packet.packet.identities.length} chains
          </Text>
        </Flex>
      );
    case "inferenceCommit":
      return (
        <Flex direction="column">
          <Text size="3" color="orange">
            Inference Commit
          </Text>
          <Text size="1" color="gray">
            Request ID: {packet.packet.requestId}
          </Text>
          <Text size="1" color="gray">
            Inference ID: {packet.packet.inferenceId}
          </Text>
        </Flex>
      );
    case "inferenceRevealRequest":
      return (
        <Flex direction="column">
          <Text size="3" color="orange">
            Inference Reveal Request
          </Text>
          <Text size="1" color="gray">
            Request ID: {packet.packet.requestId}
          </Text>
          <Text size="1" color="gray">
            Quorum Size: {packet.packet.quorum.length}
          </Text>
          <Text size="1" color="gray">
            Timeout: {packet.packet.timeoutMs}ms
          </Text>
        </Flex>
      );
    case "inferenceReveal":
      return (
        <Flex direction="column">
          <Text size="3" color="green">
            Inference Reveal
          </Text>
          <Text size="1" color="gray">
            Request ID: {packet.packet.requestId}
          </Text>
          <Text size="1" color="gray">
            Inference ID: {packet.packet.inferenceId}
          </Text>
        </Flex>
      );
    case "inferenceRevealRejected":
      return (
        <Flex direction="column">
          <Text size="3" color="red">
            Inference Reveal Rejected
          </Text>
          <Text size="1" color="gray">
            Request ID: {packet.packet.requestId}
          </Text>
          <Text size="1" color="gray">
            Inference ID: {packet.packet.inferenceId}
          </Text>
          <Text size="1" color="gray">
            Reject Reason: {capitalizeWords(packet.packet.rejectReason.type)}
          </Text>
        </Flex>
      );
    case "inferenceQuorumComputed":
      return (
        <Flex direction="column">
          <Text size="3" color="green">
            Inference Quorum Computed
          </Text>
          <Text size="1" color="gray">
            Request ID: {packet.packet.requestId}
          </Text>
          <Text size="1" color="gray">
            Verified By: {packet.packet.verifiedBy}
          </Text>
          <Text size="1" color="gray">
            Submitted Inferences: {packet.packet.submittedInferences.length}
          </Text>
          <Text size="1" color="gray">
            Valid Inferences: {packet.packet.validInferences.length}
          </Text>
        </Flex>
      );
    case "p2pInferenceRequest":
      return (
        <Flex direction="column">
          <Text size="3" color="blue">
            P2P Inference Request
          </Text>
          <Text size="1" color="gray">
            Request ID: {packet.packet.requestId}
          </Text>
        </Flex>
      );
    default:
      return null;
  }
};

export default function Packets() {
  const packets = usePackets({ packetLimit: 500 });
  const [search, setSearch] = useState<string>("");
  const debouncedSearch = useDebounce(search, 100);
  const [filteredPackets, setFilteredPackets] = useState<ReceivedPeerPacket[]>(
    []
  );

  useEffect(() => {
    if (packets)
      if (debouncedSearch)
        setFilteredPackets(
          packets.packets.filter(
            // TODO: Really dumb brute force way to filter, I know I know
            (packet) =>
              packet.packet.type
                .toLowerCase()
                .includes(debouncedSearch.split(" ").join("").toLowerCase())
          )
        );
      else setFilteredPackets(packets.packets);
  }, [debouncedSearch, packets]);

  return (
    (packets && (
      <Flex direction="column" gap="4" py="4">
        <TextField.Root
          placeholder={`Search ${packets.total} packet types...`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        >
          <TextField.Slot>
            <MagnifyingGlassIcon height="16" width="16" />
          </TextField.Slot>
        </TextField.Root>
        {filteredPackets.map((packet) => (
          <Card
            key={packet.signature + packet.synthientId}
            style={{
              backgroundColor:
                packet.packet.type.startsWith("inference") ||
                packet.packet.type === "p2pInferenceRequest"
                  ? "$orange3"
                  : "$gray3",
            }}
          >
            <Flex align="center" gap="2">
              {getPacketIcon(packet.packet.type)}
              <Flex direction="column" flexGrow="1">
                {getPacketMeta(packet)}
                <Flex justify="between" mt="1">
                  <Text size="1" color="gray" weight="medium">
                    from {packet.synthientId.slice(0, 8)}
                  </Text>
                  <Text size="1" color="gray">
                    {timeAgo.format(
                      packet.receivedTime || new Date(packet.packet.createdAt)
                    )}
                  </Text>
                </Flex>
              </Flex>
            </Flex>
          </Card>
        ))}
      </Flex>
    )) || <Spinner size="2" />
  );
}
