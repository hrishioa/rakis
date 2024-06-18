import { useEffect, useRef, useState } from "react";
import { ChainIdentity } from "../rakis-core/synthient-chain/db/entities";
import { TheDomain } from "../rakis-core/synthient-chain/thedomain/thedomain";
import {
  LLMModelName,
  LLMWorkerStates,
} from "../rakis-core/synthient-chain/llm/types";
import { debounce } from "lodash";
import {
  generateRandomString,
  stringifyDateWithOffset,
} from "../rakis-core/synthient-chain/utils/utils";
import { loadSettings } from "../rakis-core/synthient-chain/thedomain/settings";

const POLLING_INTERVAL = 3000; // 5 seconds

const last24HoursDate = new Date();
last24HoursDate.setDate(last24HoursDate.getDate() - 1);

export function useTheDomain(
  identityPassword: string,
  overwriteIdentity: boolean
) {
  const domainRef = useRef<TheDomain | null>(null);
  const [mySynthientId, setMySynthientId] = useState<string | null>(null);
  const [llmWorkerStates, setllmWorkerStates] = useState<LLMWorkerStates>({});
  const [chainIdentities, setChainIdentities] = useState<ChainIdentity[]>([]);

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
          fromChain: "rakis",
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

  // TODO: Need to type this function later so its easier to propdrill
  async function addNewChainIdentity(
    signature: `0x${string}`,
    chain: string,
    signedWithWallet: string
  ) {
    const res = await domainRef.current?.addChainIdentity(
      signature,
      chain,
      signedWithWallet
    );

    if (res) {
      const newIdentities = domainRef.current?.chainIdentities;

      if (newIdentities) {
        setChainIdentities(newIdentities);
      }
    }
  }

  useEffect(() => {
    const updateEngines = debounce(() => {
      const engines = domainRef.current?.llmEngine?.getWorkerStates();
      console.log("Got engine states", engines);
      if (engines) {
        setllmWorkerStates(engines);
      }
    }, 100);

    const initDomain = async () => {
      const rakisSettings = loadSettings();

      const domain = await TheDomain.bootup({
        identityPassword,
        overwriteIdentity,
        initialEmbeddingWorkers:
          rakisSettings.workerSettings.initialEmbeddingWorkers,
        initialLLMWorkers: rakisSettings.workerSettings.initialLLMWorkers,
      });
      domainRef.current = domain;

      setMySynthientId(domain.synthientId);
      setChainIdentities(domain.chainIdentities || []);

      domain.llmEngine.on("workerFree", updateEngines);
      domain.llmEngine.on("workerLoading", updateEngines);
      domain.llmEngine.on("workerLoadFailed", updateEngines);
      domain.llmEngine.on("workerBusy", updateEngines);
      domain.llmEngine.on("workerLoaded", updateEngines);
      domain.llmEngine.on("workerUnloaded", updateEngines);
      domain.llmEngine.on("modelLoadingProgress", updateEngines);

      setllmWorkerStates(domain.llmEngine.getWorkerStates());
    };

    initDomain();

    const pollData = async () => {
      if (!domainRef.current) return;

      const [latestPeers, latestPackets, llmEngineLogs, inferences, peerCount] =
        await Promise.all([
          domainRef.current.packetDB.peerDB.getLastPeers(last24HoursDate, 100),
          domainRef.current.packetDB.getLastPackets(100),
          domainRef.current.llmEngine.getEngineLogs(100),
          domainRef.current.inferenceDB.getInferences(10),
          domainRef.current.packetDB.peerDB.getPeerCount(),
        ]);
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
    llmWorkerStates,
    scaleLLMWorkers,
    submitInferenceRequest,
    chainIdentities,
    addNewChainIdentity,
  };
}
