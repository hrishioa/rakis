import { useEffect, useRef, useState } from "react";
import {
  Peer,
  InferenceQuorum,
  ConsensusResults,
} from "../../core/synthient-chain/db/entities";
import {
  ReceivedPeerPacket,
  InferenceRequest,
  InferenceResult,
  InferenceEmbedding,
} from "../../core/synthient-chain/db/packet-types";
import { LLMModelName } from "../../core/synthient-chain/llm/types";
import { TheDomain } from "../../core/synthient-chain/thedomain/thedomain";

const POLLING_INTERVAL = 5000; // 5 seconds

export function useTheDomain(
  identityPassword: string,
  overwriteIdentity: boolean
) {
  const domainRef = useRef<TheDomain | null>(null);
  const [peers, setPeers] = useState<Peer[]>([]);
  const [packets, setPackets] = useState<ReceivedPeerPacket[]>([]);
  const [inferenceRequests, setInferenceRequests] = useState<
    InferenceRequest[]
  >([]);
  const [inferenceResults, setInferenceResults] = useState<InferenceResult[]>(
    []
  );
  const [inferenceEmbeddings, setInferenceEmbeddings] = useState<
    InferenceEmbedding[]
  >([]);
  const [quorums, setQuorums] = useState<InferenceQuorum[]>([]);
  const [consensusResults, setConsensusResults] = useState<ConsensusResults[]>(
    []
  );
  const [inferenceWorkerStates, setInferenceWorkerStates] = useState<{
    [workerId: string]: { modelName: LLMModelName; state: string };
  }>({});

  useEffect(() => {
    const initDomain = async () => {
      const domain = await TheDomain.bootup({
        identityPassword,
        overwriteIdentity,
        initialLLMWorkers: [{ modelName: "gemma-2b-it-q4f16_1", count: 2 }],
        initialEmbeddingWorkers: [
          { modelName: "nomic-ai/nomic-embed-text-v1.5", count: 1 },
        ],
      });
      domainRef.current = domain;
    };

    initDomain();

    const pollData = async () => {
      if (!domainRef.current) return;

      const [
        latestPeers,
        latestPackets,
        latestInferenceRequests,
        latestInferenceResults,
        latestInferenceEmbeddings,
        latestQuorums,
        latestConsensusResults,
        inferenceWorkerStates,
      ] = await Promise.all([
        domainRef.current.packetDB.peerDB.getLastPeers(100),
        domainRef.current.packetDB.getLastPackets(100),
        domainRef.current.inferenceDB.getLastInferenceRequests(100),
        domainRef.current.inferenceDB.getLastInferenceResults(100),
        domainRef.current.inferenceDB.getLastInferenceEmbeddings(100),
        domainRef.current.inferenceDB.quorumDb.getLastQuorums(100),
        domainRef.current.inferenceDB.quorumDb.getLastConsensusResults(100),
        domainRef.current.llmEngine.getWorkerStates(),
      ]);

      setPeers(latestPeers);
      setPackets(latestPackets);
      setInferenceRequests(latestInferenceRequests);
      setInferenceResults(latestInferenceResults);
      setInferenceEmbeddings(latestInferenceEmbeddings);
      setQuorums(latestQuorums);
      setConsensusResults(latestConsensusResults);
    };

    const intervalId = setInterval(pollData, POLLING_INTERVAL);

    return () => {
      clearInterval(intervalId);
    };
  }, [identityPassword, overwriteIdentity]);

  return {
    peers,
    packets,
    inferenceRequests,
    inferenceResults,
    inferenceEmbeddings,
    quorums,
    consensusResults,
    inferenceWorkerStates,
  };
}
