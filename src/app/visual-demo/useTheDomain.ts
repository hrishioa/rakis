import { useEffect, useRef, useState } from "react";
import {
  ConsensusResults,
  InferenceQuorum,
  Peer,
} from "../../core/synthient-chain/db/entities";
import { TheDomain } from "../../core/synthient-chain/thedomain/thedomain";
import {
  InferenceEmbedding,
  InferenceResult,
  ReceivedPeerPacket,
  UnprocessedInferenceRequest,
} from "../../core/synthient-chain/db/packet-types";
import {
  LLMEngineLogEntry,
  LLMModelName,
} from "../../core/synthient-chain/llm/types";
import { debounce, set } from "lodash";

const POLLING_INTERVAL = 1500; // 5 seconds

const last24HoursDate = new Date();
last24HoursDate.setDate(last24HoursDate.getDate() - 1);

export function useTheDomain(
  identityPassword: string,
  overwriteIdentity: boolean
) {
  const domainRef = useRef<TheDomain | null>(null);
  const [peers, setPeers] = useState<Peer[]>([]);
  const [mySynthientId, setMySynthientId] = useState<string | null>(null);
  const [packets, setPackets] = useState<{
    packets: ReceivedPeerPacket[];
    total: number;
  } | null>(null);
  const [llmWorkerStates, setllmWorkerStates] = useState<{
    [workerId: string]: { modelName: LLMModelName; state: string };
  }>({});
  const [llmEngineLog, setLLMEngineLog] = useState<LLMEngineLogEntry[]>([]);
  const [inferences, setInferences] = useState<
    {
      request: Required<UnprocessedInferenceRequest>;
      result: InferenceResult | undefined;
      embedding: InferenceEmbedding | undefined;
      quorum: InferenceQuorum | undefined;
      consensusResult: ConsensusResults | undefined;
    }[]
  >([]);

  function scaleLLMWorkers(modelName: LLMModelName, count: number) {
    domainRef.current?.llmEngine.scaleLLMWorkers(modelName, count);
  }

  useEffect(() => {
    const updateEngines = debounce(() => {
      const engines = domainRef.current?.llmEngine?.getWorkerStates();
      if (engines) {
        setllmWorkerStates(engines);
      }
    }, 100);

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

      setMySynthientId(domain.synthientId);

      domain.llmEngine.on("workerFree", updateEngines);
      domain.llmEngine.on("workerLoadFailed", updateEngines);
      domain.llmEngine.on("workerLoaded", updateEngines);
      domain.llmEngine.on("workerUnloaded", updateEngines);

      setllmWorkerStates(domain.llmEngine.getWorkerStates());
    };

    initDomain();

    const pollData = async () => {
      if (!domainRef.current) return;

      const [latestPeers, latestPackets, llmEngineLogs, inferences] =
        await Promise.all([
          domainRef.current.packetDB.peerDB.getLastPeers(last24HoursDate, 100),
          domainRef.current.packetDB.getLastPackets(100),
          domainRef.current.llmEngine.getEngineLogs(100),
          domainRef.current.inferenceDB.getInferences(10),
        ]);

      setPeers(latestPeers || []);
      setPackets(latestPackets);
      setLLMEngineLog(llmEngineLogs);
      setInferences(inferences);
    };

    const intervalId = setInterval(pollData, POLLING_INTERVAL);

    return () => {
      clearInterval(intervalId);
      domainRef.current?.llmEngine.removeListener("workerFree", updateEngines);
      domainRef.current?.llmEngine.removeListener(
        "workerLoadFailed",
        updateEngines
      );
      domainRef.current?.llmEngine.removeListener(
        "workerLoaded",
        updateEngines
      );
      domainRef.current?.llmEngine.removeListener(
        "workerUnloaded",
        updateEngines
      );
    };
  }, [identityPassword, overwriteIdentity]);

  return {
    mySynthientId,
    peers,
    packets,
    llmWorkerStates,
    llmEngineLog,
    inferences,
    scaleLLMWorkers,
  };
}
