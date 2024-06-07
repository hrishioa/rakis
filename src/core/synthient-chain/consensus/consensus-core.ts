import { EmbeddingResult } from "../../embeddings/types";
import {
  InferenceQuorumComputed,
  InferenceRevealRejected,
  InferenceSecurityFrame,
} from "../db/packet-types";
import { InferenceQuorum } from "../db/quorumdb";
import { QUORUM_SETTINGS } from "../thedomain/settings";
import { createLogger, logStyles } from "../utils/logger";
import cosSimilarity from "cos-similarity";
import { stringifyDateWithOffset } from "../utils/utils";
import { hashBinaryEmbedding, hashString } from "../utils/simple-crypto";

const logger = createLogger("Consensus Core", logStyles.consensusCore);

export async function runFinalConsensus(
  quorum: InferenceQuorum,
  verifiedEmbeddingResults: EmbeddingResult[],
  ourSynthientId: string,
  securityFrame: InferenceSecurityFrame
): Promise<{
  rejectionPackets: InferenceRevealRejected[];
  successfulInference?: InferenceQuorumComputed;
}> {
  logger.debug(
    "Running final consensus for ",
    quorum,
    " with ",
    quorum.quorum.length,
    " commits"
  );

  // First let's remove all the non-revealed commits

  quorum.quorum = quorum.quorum.filter((inference) => inference.reveal);

  logger.debug(
    "Removed non-revealed commits, ",
    quorum.quorum.length,
    " commits remaining"
  );

  // Next we want to remove any non-verified embeddings and generate a series of rejection packets

  const rejectionPackets: InferenceRevealRejected[] = [];

  quorum.quorum = (
    await Promise.all(
      quorum.quorum.map(async (revealedCommit) => {
        if (revealedCommit.synthientId === ourSynthientId) {
          return revealedCommit;
        }

        if (!revealedCommit.reveal) {
          return false;
        }

        const verifiedEmbedding = verifiedEmbeddingResults.find(
          (e) => e.text === revealedCommit.reveal!.output
        );

        if (!verifiedEmbedding) {
          logger.error(
            "Could not find verified embedding for ",
            revealedCommit,
            " from results ",
            verifiedEmbeddingResults
          );
          return false;
        }

        const similarity = cosSimilarity(
          revealedCommit.reveal.bEmbedding,
          verifiedEmbedding.binaryEmbedding
        );

        if (similarity > QUORUM_SETTINGS.bEmbeddingThreshold) {
          logger.warn(
            "Rejecting reveal for ",
            revealedCommit,
            " with similarity ",
            similarity,
            " to verified embedding ",
            verifiedEmbedding,
            " over threshold ",
            QUORUM_SETTINGS.bEmbeddingThreshold
          );

          rejectionPackets.push({
            createdAt: stringifyDateWithOffset(new Date()),
            type: "inferenceRevealRejected",
            requestId: quorum.requestId,
            inferenceId: revealedCommit.inferenceId,
            rejectReason: {
              type: "computed_bembedding_fails_threshold",
              computedBEmbedding: verifiedEmbedding.binaryEmbedding,
              revealedBEmbedding: revealedCommit.reveal.bEmbedding,
            },
          });

          return false;
        }

        // We need to do this weird thing because sending the array over the wire mangles it for some reason
        // TODO: Investigate if it's only one particular P2P
        // network that does this
        const rehash = await hashBinaryEmbedding(
          Object.values(revealedCommit.reveal.bEmbedding as any) as number[]
        );

        if (rehash !== revealedCommit.bEmbeddingHash) {
          logger.warn(
            "Rejecting reveal for ",
            revealedCommit,
            " with hash mismatch ",
            rehash,
            " !== ",
            revealedCommit.bEmbeddingHash
          );

          rejectionPackets.push({
            createdAt: stringifyDateWithOffset(new Date()),
            type: "inferenceRevealRejected",
            requestId: quorum.requestId,
            inferenceId: revealedCommit.inferenceId,
            rejectReason: {
              type: "bembedding_hash_mismatch",
              computedBEmbeddingHash: rehash,
              revealedBEmbeddingHash: revealedCommit.bEmbeddingHash,
              revealedBEmbedding: revealedCommit.reveal.bEmbedding,
            },
          });

          return false;
        }

        return revealedCommit;
      })
    )
  ).filter((q) => q !== false) as InferenceQuorum["quorum"];

  logger.debug(
    "Removed non-verified commits, ",
    quorum.quorum.length,
    " commits remaining"
  );

  if (quorum.quorum.length < quorum.quorumThreshold) {
    logger.debug(
      "Quorum did not reach threshold, ",
      quorum.quorum.length,
      " < ",
      quorum.quorumThreshold
    );

    return {
      rejectionPackets,
    };
  }

  console.time(`Computing clusters for ${quorum.quorum.length} commits`);

  // This is an n^2 solution, we can replace it with DBSCAN, OPTICS or KNN later
  // There's also other optimizations we can do - DBSCAN especially would be good way
  // to handle outliers and noise

  const distances: number[][] = [];

  for (let i = 0; i < quorum.quorum.length; i++) {
    distances[i] = [];
    for (let j = 0; j < quorum.quorum.length; j++) {
      distances[i][j] =
        i === j
          ? 0
          : cosSimilarity(
              quorum.quorum[i].reveal!.embedding,
              quorum.quorum[j].reveal!.embedding
            );
    }
  }

  logger.debug(
    "Computed distances for ",
    quorum.quorum.length,
    " commits - ",
    distances
  );

  const clusterSizes = distances
    .map((distanceMap) =>
      distanceMap.filter((d) => d < securityFrame.secDistance)
    )
    .map((d, i) => ({
      commitIndex: i,
      clusterSize: d.length,
    }));

  logger.debug(
    "Computed cluster sizes for ",
    quorum.quorum.length,
    " commits - ",
    clusterSizes
  );

  const clusterSizeNeeded = Math.floor(
    (securityFrame.secPercentage * quorum.quorum.length) / 100.0
  );

  logger.debug(
    "Computed cluster size needed for ",
    quorum.quorum.length,
    " commits - ",
    clusterSizeNeeded
  );

  const largestSizes = clusterSizes
    .filter((cS) => cS.clusterSize >= clusterSizeNeeded)
    .sort((a, b) => b.clusterSize - a.clusterSize);

  logger.debug(
    "Computed largest cluster sizes for ",
    quorum.quorum.length,
    " commits - ",
    largestSizes
  );

  console.timeEnd(`Computing clusters for ${quorum.quorum.length} commits`);

  if (!largestSizes.length) {
    logger.debug(
      "No clusters found with size ",
      clusterSizeNeeded,
      " or greater"
    );

    return {
      rejectionPackets,
    };
  }

  const largestCluster = largestSizes[0];

  logger.debug(
    "Found largest cluster with size ",
    largestCluster.clusterSize,
    " at index ",
    largestCluster.commitIndex
  );

  const acceptedInferenceIndices = distances[largestCluster.commitIndex]
    .map((distance, index) =>
      distance >= securityFrame.secDistance ? false : index
    )
    .filter((index) => index !== false);

  logger.debug(
    "Accepted inferences for largest cluster: ",
    acceptedInferenceIndices
  );

  const acceptedInferences = acceptedInferenceIndices.map(
    (index) => quorum.quorum[index]
  );

  logger.debug("Accepted inferences for largest cluster: ", acceptedInferences);

  const inferenceJointHash = await hashString(
    quorum.requestId +
      acceptedInferences
        .map((inference) => inference.bEmbeddingHash + inference.inferenceId)
        .join("")
  );

  const selectedInference =
    acceptedInferences[
      parseInt(inferenceJointHash.slice(0, 16), 16) % acceptedInferences.length
    ];

  const inferenceQuorumComputed: InferenceQuorumComputed = {
    type: "inferenceQuorumComputed",
    createdAt: stringifyDateWithOffset(new Date()),
    requestId: quorum.requestId,
    verifiedBy: ourSynthientId,
    submittedInferences: quorum.quorum.map((inference) => ({
      inferenceId: inference.inferenceId,
    })),
    validInferences: acceptedInferences.map((inference) => ({
      inferenceId: inference.inferenceId,
    })),
    validInferenceJointHash: inferenceJointHash,
    validSingleInference: {
      output: selectedInference.reveal!.output,
      fromSynthientId: selectedInference.synthientId,
      bEmbeddingHash: selectedInference.bEmbeddingHash,
    },
  };

  console.log("Final Computed inference quorum: ", inferenceQuorumComputed);

  return {
    rejectionPackets,
    successfulInference: inferenceQuorumComputed,
  };
}
