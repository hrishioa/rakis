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
import { EmbeddingModelName } from "../../core/synthient-chain/embeddings/types";
import {
  generateRandomString,
  stringifyDateWithOffset,
} from "../../core/synthient-chain/utils/utils";

const POLLING_INTERVAL = 3000; // 5 seconds

const last24HoursDate = new Date();
last24HoursDate.setDate(last24HoursDate.getDate() - 1);

export type InferencesForDisplay = {
  requestId: string;
  requestedAt: string;
  endingAt: Date;
  requestPayload: {
    fromChain: string; // what chain did we get this on?
    createdAt: string;
    prompt: string;
    acceptedModels: LLMModelName[];
    temperature: number;
    maxTokens: number;
    securityFrame: {
      quorum: number; // Number of inferences that need to happen for a quorum
      maxTimeMs: number; // Max amount of time that this round can take before failed inference
      secDistance: number; // Distance in embeddingspace
      secPercentage: number; // Percentage of quorum that needs to be within secDistance embedding distance
      embeddingModel: EmbeddingModelName;
    };
  };
  ourResult?: {
    // this will be true if we participated.
    payload: {
      requestId: string;
      inferenceId: string;
      startedAt: string; // timezoned date
      completedAt: string; // timezoned date
    } & {
      result:
        | {
            success: true;
            result: string;
            tokenCount: number;
          }
        | {
            success: false;
            error: any;
          };
    };
    bEmbeddingHash?: string;
  };
  quorum?: {
    // This is the consensus quorum where other nodes are participating.
    status:
      | "awaiting_commitments"
      | "awaiting_reveal"
      | "failed"
      | "completed"
      | "awaiting_consensus"
      | "verifying_consensus";
    quorumThreshold: number;
    quorumCommitted: number;
    quorumRevealed: number;
    quorum: {
      inferenceId: string;
      synthientId: string;
      commitReceivedAt: Date;
      bEmbeddingHash: string;
      reveal?: {
        output: string;
        receivedAt: Date;
      };
    }[];
  };
  consensusResult?: {
    status: string;
    result?: {
      submittedInferences: {
        inferenceId: string;
      }[];
      validInferences: {
        inferenceId: string;
      }[];
      validInferenceJointHash: string;
      validInference: {
        output: string;
        fromSynthientId: string;
        bEmbeddingHash: string;
      };
    };
  };
};

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
  const [inferences, setInferences] = useState<InferencesForDisplay[]>([]);

  function scaleLLMWorkers(modelName: LLMModelName, count: number) {
    domainRef.current?.llmEngine.scaleLLMWorkers(modelName, count);
  }

  const submitInferenceRequest = debounce(
    (
      prompt: string,
      models: LLMModelName[],
      minimumParticipants: number,
      timeAvailableSeconds: number,
      percentageAgreement: number
    ) => {
      domainRef.current?.packetDB.transmitPacket({
        type: "p2pInferenceRequest",
        requestId: generateRandomString(10),
        payload: {
          fromChain: "ecumene",
          blockNumber: 0,
          createdAt: stringifyDateWithOffset(new Date()),
          prompt,
          acceptedModels: models,
          temperature: 1,
          maxTokens: 2048,
          securityFrame: {
            quorum: minimumParticipants,
            maxTimeMs: timeAvailableSeconds * 1000,
            secDistance: 4500,
            secPercentage: percentageAgreement / 100.0,
            embeddingModel: "nomic-ai/nomic-embed-text-v1.5",
          },
        },
        createdAt: stringifyDateWithOffset(new Date()),
      });
    },
    500
  );

  useEffect(() => {
    const updateEngines = debounce(() => {
      const engines = domainRef.current?.llmEngine?.getWorkerStates();
      if (engines) {
        setllmWorkerStates(engines);
      }
    }, 100);

    const updateInferences = debounce(async () => {
      const inferences = await domainRef.current?.inferenceDB?.getInferences(
        10
      );
      if (inferences) {
        setInferences(inferences);
      }

      const packets = await domainRef.current?.packetDB?.getLastPackets(100);
      if (packets) {
        setPackets(packets);
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

      domain.inferenceDB.on(
        "inferenceResultAwaitingEmbedding",
        updateInferences
      );
      domain.inferenceDB.on("newActiveInferenceRequest", updateInferences);
      domain.inferenceDB.on("newInferenceRequest", updateInferences);
      domain.inferenceDB.on("requestQuorumReveal", updateInferences);
      domain.inferenceDB.on("revealedInference", updateInferences);
      domain.inferenceDB.on("newInferenceEmbedding", updateInferences);

      domain.packetDB.on("newInferenceCommit", updateInferences);
      domain.packetDB.on("newInferenceRevealRequest", updateInferences);
      domain.packetDB.on("newInferenceRevealed", updateInferences);
      domain.packetDB.on("newP2PInferenceRequest", updateInferences);

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

      domainRef.current?.inferenceDB.removeListener(
        "inferenceResultAwaitingEmbedding",
        updateInferences
      );
      domainRef.current?.inferenceDB.removeListener(
        "newActiveInferenceRequest",
        updateInferences
      );
      domainRef.current?.inferenceDB.removeListener(
        "newInferenceRequest",
        updateInferences
      );
      domainRef.current?.inferenceDB.removeListener(
        "requestQuorumReveal",
        updateInferences
      );
      domainRef.current?.inferenceDB.removeListener(
        "revealedInference",
        updateInferences
      );
      domainRef.current?.inferenceDB.removeListener(
        "newInferenceEmbedding",
        updateInferences
      );

      domainRef.current?.packetDB.removeListener(
        "newInferenceCommit",
        updateInferences
      );
      domainRef.current?.packetDB.removeListener(
        "newInferenceRevealRequest",
        updateInferences
      );
      domainRef.current?.packetDB.removeListener(
        "newInferenceRevealed",
        updateInferences
      );
      domainRef.current?.packetDB.removeListener(
        "newP2PInferenceRequest",
        updateInferences
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
    submitInferenceRequest,
  };
}
