import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import {
  PeerPacket,
  ReceivedPeerPacket,
} from "../../core/synthient-chain/db/packet-types";
import { cn } from "../../lib/utils";

const packetTypeIcons: Record<string, string> = {
  peerStatusUpdate: "📊",
  peerHeart: "❤️",
  peerInfo: "ℹ️",
  peerConnectedChain: "🔗",
  inferenceCommit: "🔒",
  inferenceRevealRequest: "🔍",
  inferenceReveal: "🔓",
  p2pInferenceRequest: "📩",
  inferenceRevealRejected: "❌",
  inferenceQuorumComputed: "✅",
};

const packetTypeColors: Record<string, string> = {
  peerStatusUpdate: "bg-blue-100 text-blue-800",
  peerHeart: "bg-pink-100 text-pink-800",
  peerInfo: "bg-gray-100 text-gray-800",
  peerConnectedChain: "bg-green-100 text-green-800",
  inferenceCommit: "bg-yellow-100 text-yellow-800",
  inferenceRevealRequest: "bg-orange-100 text-orange-800",
  inferenceReveal: "bg-teal-100 text-teal-800",
  p2pInferenceRequest: "bg-indigo-100 text-indigo-800",
  inferenceRevealRejected: "bg-red-100 text-red-800",
  inferenceQuorumComputed: "bg-emerald-100 text-emerald-800",
};

function PacketDetails({ packet }: { packet: PeerPacket }) {
  switch (packet.type) {
    case "peerStatusUpdate":
      return (
        <div className="text-xs">
          <div>
            <strong>Status:</strong> {packet.status}
          </div>
          {(packet as any).workerId && (
            <div>
              <strong>Worker ID:</strong> {(packet as any).workerId}
            </div>
          )}
          {(packet as any).modelName && (
            <div>
              <strong>Model Name:</strong> {(packet as any).modelName}
            </div>
          )}
          {(packet as any).tps && (
            <div>
              <strong>TPS:</strong> {(packet as any).tps}
            </div>
          )}
          {(packet as any).embeddingModels && (
            <div>
              <strong>Embedding Models:</strong>{" "}
              {(packet as any).embeddingModels.join(", ")}
            </div>
          )}
          {(packet as any).requestId && (
            <div>
              <strong>Request ID:</strong> {(packet as any).requestId}
            </div>
          )}
        </div>
      );
    case "peerHeart":
      return (
        <div className="text-xs">
          <div>
            <strong>Window X:</strong> {packet.windowX}
          </div>
          <div>
            <strong>Window Y:</strong> {packet.windowY}
          </div>
        </div>
      );
    case "peerInfo":
      return (
        <div className="text-xs">
          <div>
            <strong>Device Info:</strong> {packet.deviceInfo}
          </div>
        </div>
      );
    case "peerConnectedChain":
      return (
        <div className="text-xs">
          <div>
            <strong>Identities:</strong>
          </div>
          <ul>
            {packet.identities.map((identity: any, index: number) => (
              <li key={index}>{identity}</li>
            ))}
          </ul>
        </div>
      );
    case "inferenceCommit":
      return (
        <div className="text-xs">
          <div>
            <strong>B Embedding Hash:</strong> {packet.bEmbeddingHash}
          </div>
          <div>
            <strong>Request ID:</strong> {packet.requestId}
          </div>
          <div>
            <strong>Inference ID:</strong> {packet.inferenceId}
          </div>
        </div>
      );
    case "inferenceRevealRequest":
      return (
        <div className="text-xs">
          <div>
            <strong>Request ID:</strong> {packet.requestId}
          </div>
          <div>
            <strong>Quorum:</strong>
          </div>
          <ul>
            {packet.quorum.map((item: any, index: number) => (
              <li key={index}>
                {item.synthientId.slice(0, 10)} -{" "}
                {item.inferenceId.slice(0, 10)} - {item.bEmbeddingHash}
              </li>
            ))}
          </ul>
          <div>
            <strong>Timeout MS:</strong> {packet.timeoutMs}
          </div>
        </div>
      );
    case "inferenceReveal":
      return (
        <div className="text-xs">
          <div>
            <strong>Requested Synthient ID:</strong>{" "}
            {packet.requestedSynthientId.slice(0, 10)}
          </div>
          <div>
            <strong>Request ID:</strong> {packet.requestId}
          </div>
          <div>
            <strong>Inference ID:</strong> {packet.inferenceId}
          </div>
          <div>
            <strong>Output:</strong> {packet.output}
          </div>
          <div>
            <strong>Embedding:</strong>{" "}
            {packet.embedding.slice(0, 3).join(", ") + "..."}
          </div>
          <div>
            <strong>B Embedding:</strong>{" "}
            {packet.bEmbedding.slice(0, 10).join(", ") + "..."}
          </div>
        </div>
      );
    case "p2pInferenceRequest":
      return (
        <div className="text-xs">
          <div>
            <strong>Request ID:</strong> {packet.requestId}
          </div>
          <div>
            <strong>Payload:</strong>
          </div>
          <ul>
            <li>
              <strong>From Chain:</strong> {packet.payload.fromChain}
            </li>
            <li>
              <strong>Block Number:</strong> {packet.payload.blockNumber}
            </li>
            <li>
              <strong>Created At:</strong> {packet.payload.createdAt}
            </li>
            <li>
              <strong>Prompt:</strong> {packet.payload.prompt}
            </li>
            <li>
              <strong>Accepted Models:</strong>{" "}
              {packet.payload.acceptedModels.join(", ")}
            </li>
            <li>
              <strong>Temperature:</strong> {packet.payload.temperature}
            </li>
            <li>
              <strong>Max Tokens:</strong> {packet.payload.maxTokens}
            </li>
          </ul>
        </div>
      );
    case "inferenceRevealRejected":
      return (
        <div className="text-xs">
          <div>
            <strong>Request ID:</strong> {packet.requestId}
          </div>
          <div>
            <strong>Inference ID:</strong> {packet.inferenceId}
          </div>
          <div>
            <strong>Reject Reason:</strong> {packet.rejectReason.type}
          </div>
          {packet.rejectReason.type ===
            "computed_bembedding_fails_threshold" && (
            <>
              <div>
                <strong>Computed B Embedding:</strong>{" "}
                {packet.rejectReason.computedBEmbedding.join(", ")}
              </div>
              <div>
                <strong>Revealed B Embedding:</strong>{" "}
                {packet.rejectReason.revealedBEmbedding.join(", ")}
              </div>
            </>
          )}
          {packet.rejectReason.type === "bembedding_hash_mismatch" && (
            <>
              <div>
                <strong>Revealed B Embedding:</strong>{" "}
                {packet.rejectReason.revealedBEmbedding.join(", ")}
              </div>
              <div>
                <strong>Computed B Embedding Hash:</strong>{" "}
                {packet.rejectReason.computedBEmbeddingHash}
              </div>
              <div>
                <strong>Revealed B Embedding Hash:</strong>{" "}
                {packet.rejectReason.revealedBEmbeddingHash}
              </div>
            </>
          )}
        </div>
      );
    case "inferenceQuorumComputed":
      return (
        <div className="text-xs">
          <div>
            <strong>Request ID:</strong> {packet.requestId}
          </div>
          <div>
            <strong>Verified By:</strong> {packet.verifiedBy.slice(0, 10)}
          </div>
          <div>
            <strong>Submitted Inferences:</strong>{" "}
            {packet.submittedInferences
              .map((i: any) => i.inferenceId)
              .join(", ")}
          </div>
          <div>
            <strong>Valid Inferences:</strong>{" "}
            {packet.validInferences.map((i: any) => i.inferenceId).join(", ")}
          </div>
          <div>
            <strong>Valid Inference Joint Hash:</strong>{" "}
            {packet.validInferenceJointHash}
          </div>
          <div>
            <strong>Valid Single Inference:</strong>
          </div>
          <ul>
            <li>
              <strong>Output:</strong> {packet.validSingleInference.output}
            </li>
            <li>
              <strong>From Synthient ID:</strong>{" "}
              {packet.validSingleInference.fromSynthientId}
            </li>
            <li>
              <strong>B Embedding Hash:</strong>{" "}
              {packet.validSingleInference.bEmbeddingHash}
            </li>
          </ul>
        </div>
      );
  }
  return null;
}

export default function PacketCards({
  packets,
  total,
}: {
  packets: ReceivedPeerPacket[];
  total: number;
}) {
  return (
    <div className="h-full">
      <h2 className="text-lg font-bold mb-2">
        Packets ({packets.length}/{total})
      </h2>
      <div className="space-y-2 overflow-y-auto h-[calc(50vh-4rem)]">
        {packets
          .sort(
            (a, b) =>
              new Date(b.packet.createdAt).getTime() -
              new Date(a.packet.createdAt).getTime()
          )
          .map((packet) => (
            <PacketCard key={packet.signature.slice(0, 10)} packet={packet} />
          ))}
      </div>
    </div>
  );
}

function PacketCard({ packet }: { packet: ReceivedPeerPacket }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Card
      onClick={() => setIsOpen(!isOpen)}
      className={cn(
        "w-full cursor-pointer",
        packetTypeColors[packet.packet.type]
      )}
    >
      <CardHeader className="relative">
        <CardTitle className="flex items-center space-x-1 text-sm">
          <span className="text-base">
            {packetTypeIcons[packet.packet.type]}
          </span>
          <span>{packet.packet.type}</span>
        </CardTitle>
        <div className="absolute top-0 right-0 text-xs pt-2 pr-3">
          <div>from {packet.synthientId.slice(0, 10)}</div>
          <div>
            {new Date(packet.packet.createdAt).toLocaleString([], {
              year: "2-digit",
              month: "numeric",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
            {packet.receivedTime && (
              <span className="ml-1">
                (
                {packet.receivedTime.getTime() -
                  new Date(packet.packet.createdAt).getTime()}
                ms)
              </span>
            )}
          </div>
        </div>
      </CardHeader>
      {isOpen && (
        <CardContent>
          <PacketDetails packet={packet.packet} />
        </CardContent>
      )}
    </Card>
  );
}
