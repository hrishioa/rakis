import { useEffect, useRef, useState } from "react";
import { TheDomain } from "../../../rakis-core/synthient-chain/thedomain/thedomain";
import { ReceivedPeerPacket } from "../../../rakis-core/synthient-chain/db/packet-types";
import { debounce } from "lodash";
import { LLMModelName } from "../../../rakis-core/synthient-chain/llm/types";
import { EmbeddingModelName } from "../../../rakis-core/synthient-chain/embeddings/types";

export type InferenceForDisplay = {
  requestId: string;
  fromSynthientId: string;
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
  externalConsensuses: {
    verifiedBy: string;
    bEmbeddingHash: string;
    output: string;
    validInferenceBy: string;
  }[];
};

export default function useInferences({
  inferenceLimit,
}: {
  inferenceLimit: number;
}) {
  const [domainInstance, setDomainInstance] = useState<TheDomain | null>(null);
  const domainPickupTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [inferences, setInferences] = useState<InferenceForDisplay[] | null>(
    null
  );
  const inferencePickupTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const refreshInferences = debounce(
    async () => {
      if (domainInstance) {
        const inferences = await domainInstance.inferenceDB.getInferences(
          inferenceLimit
        );

        setInferences(inferences);
      }
    },
    10,
    { leading: true }
  );

  useEffect(() => {
    if (!domainInstance && !domainPickupTimeoutRef.current) {
      domainPickupTimeoutRef.current = setInterval(() => {
        const dInstance = TheDomain.getInstance();
        if (dInstance) {
          clearInterval(domainPickupTimeoutRef.current!);
          domainPickupTimeoutRef.current = null;
          setDomainInstance(dInstance);
        }
      });
    } else if (domainInstance) {
      if (!inferencePickupTimeoutRef.current) {
        inferencePickupTimeoutRef.current = setInterval(() => {
          refreshInferences();
        }, 1000);
        refreshInferences();

        domainInstance.inferenceDB.on(
          "inferenceResultAwaitingEmbedding",
          refreshInferences
        );
        domainInstance.inferenceDB.on(
          "newActiveInferenceRequest",
          refreshInferences
        );
        domainInstance.inferenceDB.on("newInferenceRequest", refreshInferences);
        domainInstance.inferenceDB.on("requestQuorumReveal", refreshInferences);
        domainInstance.inferenceDB.on("revealedInference", refreshInferences);
        domainInstance.inferenceDB.on(
          "newInferenceEmbedding",
          refreshInferences
        );

        domainInstance.packetDB.on("newInferenceCommit", refreshInferences);
        domainInstance.packetDB.on(
          "newInferenceRevealRequest",
          refreshInferences
        );
        domainInstance.packetDB.on("newInferenceRevealed", refreshInferences);
        domainInstance.packetDB.on("newP2PInferenceRequest", refreshInferences);
      }
    }

    return () => {
      if (domainPickupTimeoutRef.current) {
        clearInterval(domainPickupTimeoutRef.current);
        domainPickupTimeoutRef.current = null;
      }

      if (inferencePickupTimeoutRef.current) {
        clearInterval(inferencePickupTimeoutRef.current);
        inferencePickupTimeoutRef.current = null;
      }

      if (domainInstance) {
        domainInstance.inferenceDB.off(
          "inferenceResultAwaitingEmbedding",
          refreshInferences
        );
        domainInstance.inferenceDB.off(
          "newActiveInferenceRequest",
          refreshInferences
        );
        domainInstance.inferenceDB.off(
          "newInferenceRequest",
          refreshInferences
        );
        domainInstance.inferenceDB.off(
          "requestQuorumReveal",
          refreshInferences
        );
        domainInstance.inferenceDB.off("revealedInference", refreshInferences);
        domainInstance.inferenceDB.off(
          "newInferenceEmbedding",
          refreshInferences
        );

        domainInstance.packetDB.off("newInferenceCommit", refreshInferences);
        domainInstance.packetDB.off(
          "newInferenceRevealRequest",
          refreshInferences
        );
        domainInstance.packetDB.off("newInferenceRevealed", refreshInferences);
        domainInstance.packetDB.off(
          "newP2PInferenceRequest",
          refreshInferences
        );
      }
    };
  }, [domainInstance, inferenceLimit, refreshInferences]);

  return inferences;
}
