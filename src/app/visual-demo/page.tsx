"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Checkbox } from "../../components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import { useTheDomain } from "./useTheDomain";
import { LLMModelName } from "../../core/synthient-chain/llm/types";
import {
  ConsensusResults,
  InferenceQuorum,
  Peer,
} from "../../core/synthient-chain/db/entities";
import {
  ReceivedPeerPacket,
  InferenceRequest,
  InferenceResult,
  InferenceEmbedding,
} from "../../core/synthient-chain/db/packet-types";

function DashboardContent({
  identityPassword,
  overwriteIdentity,
}: {
  identityPassword: string;
  overwriteIdentity: boolean;
}) {
  const {
    peers,
    packets,
    inferenceRequests,
    inferenceResults,
    inferenceEmbeddings,
    quorums,
    consensusResults,
    inferenceWorkerStates,
  } = useTheDomain(identityPassword, overwriteIdentity);

  return (
    <div className="p-8 overflow-auto">
      <h1>Synthient Dashboard</h1>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Consensus Results</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader>Request ID</TableHeader>
                <TableHeader>Success</TableHeader>
                <TableHeader>Reason</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {consensusResults.map((result: ConsensusResults) => (
                <TableRow key={result.requestId}>
                  <TableCell>{result.requestId}</TableCell>
                  <TableCell>{result.success ? "Success" : "Failed"}</TableCell>
                  <TableCell>{result.reason}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Quorums</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader>Request ID</TableHeader>
                <TableHeader>Status</TableHeader>
                <TableHeader>Quorum Threshold</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {quorums.map((quorum: InferenceQuorum) => (
                <TableRow key={quorum.requestId}>
                  <TableCell>{quorum.requestId}</TableCell>
                  <TableCell>{quorum.status}</TableCell>
                  <TableCell>{quorum.quorumThreshold}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Peers</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader>Synthient ID</TableHeader>
                <TableHeader>Last Seen</TableHeader>
                <TableHeader>Device Info</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {peers.map((peer: Peer) => (
                <TableRow key={peer.synthientId}>
                  <TableCell>{peer.synthientId}</TableCell>
                  <TableCell>{peer.lastSeen.toLocaleString()}</TableCell>
                  <TableCell>{peer.deviceInfo}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Packets</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader>Packet Type</TableHeader>
                <TableHeader>Synthient ID</TableHeader>
                <TableHeader>Received Time</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {packets.map((packet: ReceivedPeerPacket) => (
                <TableRow key={`${packet.synthientId}-${packet.receivedTime}`}>
                  <TableCell>{packet.packet.type}</TableCell>
                  <TableCell>{packet.synthientId}</TableCell>
                  <TableCell>
                    {packet.receivedTime?.toLocaleString() || "-"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Inference Requests</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader>Request ID</TableHeader>
                <TableHeader>From Chain</TableHeader>
                <TableHeader>Prompt</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {inferenceRequests.map((request: InferenceRequest) => (
                <TableRow key={request.requestId}>
                  <TableCell>{request.requestId}</TableCell>
                  <TableCell>{request.payload.fromChain}</TableCell>
                  <TableCell>{request.payload.prompt}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Inference Results</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader>Inference ID</TableHeader>
                <TableHeader>Request ID</TableHeader>
                <TableHeader>Success</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {inferenceResults.map((result: InferenceResult) => (
                <TableRow key={result.inferenceId}>
                  <TableCell>{result.inferenceId}</TableCell>
                  <TableCell>{result.requestId}</TableCell>
                  <TableCell>
                    {result.result.success ? "Success" : "Failed"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Inference Embeddings</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader>Inference ID</TableHeader>
                <TableHeader>Request ID</TableHeader>
                <TableHeader>B Embedding Hash</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {inferenceEmbeddings.map((embedding: InferenceEmbedding) => (
                <TableRow key={embedding.inferenceId}>
                  <TableCell>{embedding.inferenceId}</TableCell>
                  <TableCell>{embedding.requestId}</TableCell>
                  <TableCell>{embedding.bEmbeddingHash}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Inference Worker States</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader>Worker ID</TableHeader>
                <TableHeader>Model Name</TableHeader>
                <TableHeader>State</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {Object.entries(inferenceWorkerStates).map(
                ([workerId, workerState]) => (
                  <TableRow key={workerId}>
                    <TableCell>{workerId}</TableCell>
                    <TableCell>{workerState.modelName}</TableCell>
                    <TableCell>{workerState.state}</TableCell>
                  </TableRow>
                )
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

export default function Home() {
  const [password, setPassword] = useState("");
  const [overwriteIdentity, setOverwriteIdentity] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const handlePasswordSubmit = () => {
    setIsAuthenticated(true);
  };

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-96">
          <CardHeader>
            <CardTitle>Authentication</CardTitle>
          </CardHeader>
          <CardContent>
            <input
              type="password"
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 mt-2 border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-600"
            />
            <div className="mt-4">
              <Checkbox
                checked={overwriteIdentity}
                onCheckedChange={(checked) => setOverwriteIdentity(!!checked)}
              >
                Overwrite existing identity
              </Checkbox>
            </div>
          </CardContent>
          <CardFooter>
            <button
              onClick={handlePasswordSubmit}
              className="px-4 py-2 font-bold text-white bg-blue-500 rounded-full hover:bg-blue-700"
            >
              Submit
            </button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <DashboardContent
      identityPassword={password}
      overwriteIdentity={overwriteIdentity}
    />
  );
}
