import { useEffect, useRef, useState } from "react";
import { TheDomain } from "../../../rakis-core/synthient-chain/thedomain/thedomain";
import { debounce } from "lodash";
import { LLMModelName } from "../../../rakis-core/synthient-chain/llm/types";
import { EmbeddingModelName } from "../../../rakis-core/synthient-chain/embeddings/types";
import { loadSettings } from "../../../rakis-core/synthient-chain/thedomain/settings";

const settings = loadSettings();

export type InferenceState =
  | {
      state: "requested";
      at: Date;
      endingAt: Date;
      by: string;
    }
  | {
      state: "committing";
      at: Date;
      commitmentsCollected: number;
      commitmentsNeeded: number;
      endingAt: Date;
    }
  | {
      state: "revealRequested";
      at: Date;
      revealsCollected: number;
      revealsNeeded: number;
      commitments: number;
      endingAt: Date;
    }
  | {
      state: "calculatingConsensus";
      at: Date;
      endingAt: Date;
    }
  | {
      state: "collectingExternalConsensuses";
      at: Date;
      collectedExternalConsensuses: number;
      endingAt: Date;
    }
  | {
      state: "completed";
      at: Date;
      external: boolean;
      finalOutput: string;
      validCommitments: number;
      revealedCommitments: number;
      quorumThreshold: number;
      bEmbeddingHash: string;
      consensusAgreedWith: number;
      consensusDisagreedWith: number;
    }
  | {
      state: "failed";
      reason:
        | "Not enough commitments"
        | "Not enough reveals"
        | "No consensus computed"
        | "Failed Quorum";
      at: Date;
    };

export type InferenceForDisplay = {
  states: InferenceState[];
  updatedAt: Date;
} & InferenceForDisplayReturned;

export type InferenceForDisplayReturned = {
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
    consensusRequestedAt?: Date;
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
    validCommitments: number;
    allCommitments: number;
  }[];
};

function getInferenceStates(inference: InferenceForDisplayReturned) {
  const states: InferenceState[] = [];

  states.push({
    state: "requested",
    at: new Date(inference.requestedAt),
    endingAt: inference.endingAt,
    by: inference.fromSynthientId,
  });

  let skip: boolean = false;

  if (inference.quorum) {
    if (inference.quorum.quorum.length > 0) {
      states.push({
        state: "committing",
        at: inference.quorum.quorum.sort(
          (a, b) => a.commitReceivedAt.getTime() - b.commitReceivedAt.getTime()
        )[0]!.commitReceivedAt,
        commitmentsCollected: inference.quorum.quorum.length,
        commitmentsNeeded: inference.quorum.quorumThreshold,
        endingAt: inference.endingAt,
      });
    }

    if (
      inference.endingAt < new Date() &&
      (!inference.quorum ||
        inference.quorum.quorumCommitted < inference.quorum.quorumThreshold)
    ) {
      states.push({
        state: "failed",
        reason: "Not enough commitments",
        at: inference.endingAt,
      });
      skip = true;
    }

    if (
      !skip &&
      (inference.quorum.status === "awaiting_reveal" ||
        inference.quorum.quorum.filter((q) => !!q.reveal).length)
    ) {
      states.push({
        state: "revealRequested",
        at: inference.endingAt,
        revealsNeeded: inference.quorum.quorumThreshold,
        revealsCollected: inference.quorum.quorum.filter((q) => !!q.reveal)
          .length,
        commitments: inference.quorum.quorum.length,
        endingAt: new Date(
          inference.endingAt.getTime() +
            settings.quorumSettings.quorumRevealTimeoutMs
        ),
      });
    }

    if (
      !skip &&
      new Date(
        inference.endingAt.getTime() +
          settings.quorumSettings.quorumRevealTimeoutMs
      ) < new Date() &&
      !inference.quorum.quorum.filter((q) => !!q.reveal).length
    ) {
      states.push({
        state: "failed",
        reason: "Not enough reveals",
        at: new Date(
          inference.endingAt.getTime() +
            settings.quorumSettings.quorumRevealTimeoutMs
        ),
      });
      skip = true;
    }

    if (!skip && inference.quorum.consensusRequestedAt) {
      states.push({
        state: "calculatingConsensus",
        at: inference.quorum.consensusRequestedAt,
        endingAt: new Date(
          inference.quorum.consensusRequestedAt.getTime() +
            settings.quorumSettings.quorumConsensusWindowMs
        ),
      });

      if (
        new Date(
          inference.quorum.consensusRequestedAt.getTime() +
            settings.quorumSettings.quorumConsensusWindowMs
        ) < new Date() &&
        (!inference.consensusResult || !inference.externalConsensuses.length)
      ) {
        states.push({
          state: "failed",
          reason: "No consensus computed",
          at: new Date(
            inference.quorum.consensusRequestedAt.getTime() +
              settings.quorumSettings.quorumConsensusWindowMs
          ),
        });
        skip = true;
      }

      if (!skip && inference.externalConsensuses.length) {
        states.push({
          state: "collectingExternalConsensuses",
          at: inference.quorum.consensusRequestedAt,
          endingAt: new Date(
            inference.quorum.consensusRequestedAt.getTime() +
              settings.quorumSettings.quorumConsensusWindowMs
          ),
          collectedExternalConsensuses: inference.externalConsensuses.length,
        });
      }

      if (
        !skip &&
        new Date(
          inference.quorum.consensusRequestedAt.getTime() +
            settings.quorumSettings.quorumConsensusWindowMs
        ) < new Date() &&
        ((inference.consensusResult && // make this also externals
          inference.consensusResult.result) ||
          inference.externalConsensuses.length)
      ) {
        if (inference.consensusResult && inference.consensusResult.result) {
          states.push({
            state: "completed",
            at: new Date(
              inference.quorum.consensusRequestedAt.getTime() +
                settings.quorumSettings.quorumConsensusWindowMs
            ),
            external: true,
            finalOutput: inference.consensusResult.result.validInference.output,
            validCommitments:
              inference.consensusResult.result.validInferences.length,
            revealedCommitments: inference.quorum.quorum.filter(
              (q) => !!q.reveal
            ).length,
            quorumThreshold: inference.quorum.quorumThreshold,
            bEmbeddingHash:
              inference.consensusResult.result.validInferenceJointHash,
            consensusAgreedWith: inference.externalConsensuses.filter(
              (eC) =>
                eC.bEmbeddingHash ===
                inference.consensusResult!.result!.validInference.bEmbeddingHash
            ).length,
            consensusDisagreedWith: inference.externalConsensuses.filter(
              (eC) =>
                eC.bEmbeddingHash !==
                inference.consensusResult!.result!.validInference.bEmbeddingHash
            ).length,
          });
        } else if (inference.externalConsensuses.length) {
          const hashCounts: Record<string, number> = {};

          inference.externalConsensuses.forEach((eC) => {
            if (!hashCounts[eC.bEmbeddingHash]) {
              hashCounts[eC.bEmbeddingHash] = 0;
            }

            hashCounts[eC.bEmbeddingHash]++;
          });

          const maxHash = Object.keys(hashCounts).reduce((a, b) =>
            hashCounts[a] > hashCounts[b] ? a : b
          );

          const oneValidExternalConsensus = inference.externalConsensuses.find(
            (eC) => eC.bEmbeddingHash === maxHash
          )!;

          states.push({
            state: "completed",
            external: true,
            at: new Date(
              inference.quorum.consensusRequestedAt.getTime() +
                settings.quorumSettings.quorumConsensusWindowMs
            ),
            finalOutput: oneValidExternalConsensus.output,
            validCommitments: oneValidExternalConsensus.validCommitments,
            revealedCommitments: oneValidExternalConsensus.allCommitments,
            quorumThreshold: inference.quorum.quorumThreshold,
            bEmbeddingHash: oneValidExternalConsensus.bEmbeddingHash,
            consensusAgreedWith: inference.externalConsensuses.filter(
              (eC) =>
                eC.bEmbeddingHash === oneValidExternalConsensus.bEmbeddingHash
            ).length,
            consensusDisagreedWith: inference.externalConsensuses.filter(
              (eC) =>
                eC.bEmbeddingHash !== oneValidExternalConsensus.bEmbeddingHash
            ).length,
          });
        }
      }
    }
  }

  return states;
}

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

        const updatedInferences = inferences.map((inference) => {
          const states = getInferenceStates(inference);

          return {
            ...inference,
            states,
            updatedAt: states.sort(
              (aS, bS) => aS.at.getTime() - bS.at.getTime()
            )[0].at,
          };
        });

        setInferences(
          updatedInferences.sort(
            (aI, bI) => bI.updatedAt.getTime() - aI.updatedAt.getTime()
          )
        );
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
