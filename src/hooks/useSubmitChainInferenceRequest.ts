import { useRef, useEffect } from "react";
import { TheDomain } from "../rakis-core/synthient-chain/thedomain/thedomain";
import { LLMModelName } from "../rakis-core/synthient-chain/llm/types";
import { stringifyDateWithOffset } from "../rakis-core/synthient-chain/utils/utils";
import { InferenceRequestPayload } from "../rakis-core/synthient-chain/db/packet-types";

export function useSubmitChainInferenceRequest() {
  const domainRef = useRef<TheDomain | null>(null);
  const domainPickupTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const submitChainInferenceRequest = (
    caller: `0x${string}`,
    prompt: string,
    model: string,
    blockNumber: string,
    maxTokens: number,
    chainName: string,
    chainId: number,
    txHash: string,
    invocationId: number
  ) => {
    if (domainRef.current) {
      const inferencePayload: InferenceRequestPayload = {
        fromChain: chainName,
        blockNumber: parseInt(blockNumber),
        prompt,
        fromAccount: caller,
        // TODO: Actually get the tx date and use that instead here
        createdAt: stringifyDateWithOffset(new Date()),
        acceptedModels: [model as LLMModelName],
        temperature: 1,
        txHash,
        chainId,
        maxTokens,
        // TODO: Actually implement this once early testing is done
        // Will need additional changes to the request format
        securityFrame: {
          quorum: 4,
          maxTimeMs: 30000,
          secDistance: 4500,
          secPercentage: 0.5,
          embeddingModel: "nomic-ai/nomic-embed-text-v1.5",
        },
      };

      const internalInferencePacket = {
        fetchedAt: new Date(),
        fromSynthientId: domainRef.current.synthientId,
        requestId: `${chainName}-${blockNumber}-${invocationId}`,
        payload: inferencePayload,
      };

      console.log("Saving inference request to DB", internalInferencePacket);

      domainRef.current.inferenceDB.saveInferenceRequest(
        internalInferencePacket
      );

      domainRef.current.packetDB.transmitPacket({
        type: "p2pInferenceRequest",
        requestId: `${chainName}-${blockNumber}-${invocationId}`,
        payload: inferencePayload,
        createdAt: stringifyDateWithOffset(new Date()),
      });
    }
  };

  useEffect(() => {
    if (!domainRef.current && !domainPickupTimeoutRef.current) {
      domainPickupTimeoutRef.current = setInterval(() => {
        const dInstance = TheDomain.getInstance();
        if (dInstance) {
          clearInterval(domainPickupTimeoutRef.current!);
          domainPickupTimeoutRef.current = null;
          domainRef.current = dInstance;
        }
      }, 1000);
    }
  });

  return submitChainInferenceRequest;
}
