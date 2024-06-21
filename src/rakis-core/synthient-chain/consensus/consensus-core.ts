import { EmbeddingResult } from "../embeddings/types";
import {
  InferenceQuorumComputed,
  InferenceRevealRejected,
  InferenceSecurityFrame,
} from "../db/packet-types";
import { createLogger, logStyles } from "../utils/logger";
import cosSimilarity from "cos-similarity";
import { stringifyDateWithOffset } from "../utils/utils";
import { hashBinaryEmbedding, hashString } from "../utils/simple-crypto";
import { InferenceQuorum, ConsensusResults } from "../db/entities";
import { loadSettings } from "../thedomain/settings";

const logger = createLogger("Consensus Core", logStyles.consensusCore);

const quorumSettings = loadSettings().quorumSettings;

// TODO: Change this to a worker in case it becomes
// Computationally expensive

export async function runFinalConsensus(
  quorum: InferenceQuorum,
  verifiedEmbeddingResults: EmbeddingResult[],
  ourSynthientId: string,
  securityFrame: InferenceSecurityFrame
): Promise<ConsensusResults> {
  logger.debug(
    `Consensus ${quorum.requestId}: Running final consensus with ${quorum.quorum.length} commits `,
    quorum
  );

  const clusterSizeNeeded = Math.ceil(
    securityFrame.secPercentage * quorum.quorum.length
  );

  // First let's remove all the non-revealed commits

  quorum.quorum = quorum.quorum.filter((inference) => inference.reveal);

  logger.debug(
    `Consensus ${quorum.requestId}: Removed non-revealed commits, ${quorum.quorum.length} commits remaining`
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
            `Consensus ${quorum.requestId}: Could not find verified embedding for revealed commit `,
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

        if (similarity < 1 - quorumSettings.bEmbeddingThreshold) {
          logger.warn(
            `Consensus ${quorum.requestId}: Rejecting reveal for ${revealedCommit.inferenceId} from ${revealedCommit.synthientId} - our embeddings didn't match`,
            revealedCommit,
            " with similarity ",
            similarity,
            " to verified embedding ",
            verifiedEmbedding,
            " over threshold ",
            quorumSettings.bEmbeddingThreshold
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
          Object.values(revealedCommit.reveal.bEmbedding as any) as number[],
          revealedCommit.synthientId
        );

        if (rehash !== revealedCommit.bEmbeddingHash) {
          logger.warn(
            `Consensus ${quorum.requestId}: Rejecting reveal for ${revealedCommit.inferenceId} from ${revealedCommit.synthientId} - our hash didn't match`,
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
    `Consensus ${quorum.requestId}: Removed non-verified commits, ${quorum.quorum.length} commits remaining`
  );

  if (quorum.quorum.length < quorum.quorumThreshold) {
    logger.debug(
      `Consensus ${quorum.requestId}: Quorum for ${quorum.requestId} did not reach threshold, ${quorum.quorum.length} < threshold ${quorum.quorumThreshold}`
    );

    return {
      requestId: quorum.requestId,
      success: false,
      reason: "did_not_reach_threshold_after_prune",
      debug: {
        clusterSizeNeeded,
      },
      rejectionPackets,
    };
  }

  console.time(`Computing clusters for ${quorum.quorum.length} commits`);

  // This is an n^2 solution, we can replace it with DBSCAN, OPTICS or KNN later
  // There's also other optimizations we can do - DBSCAN especially would be good way
  // to handle outliers and noise

  const distances: number[][] = [];

  // Using euclidean for now, according to this (I should do more research) there's not much of a diff between it and dot product
  // https://www.cse.msu.edu/%7Epramanik/research/papers/2003Papers/sac04.pdf

  // TODO: Super easy optimization here is just to only compute one side of the diagonal in this matrix, skipping for time

  for (let i = 0; i < quorum.quorum.length; i++) {
    distances[i] = [];
    for (let j = 0; j < quorum.quorum.length; j++) {
      distances[i][j] =
        i === j
          ? 0
          : Math.sqrt(
              quorum.quorum[i].reveal!.bEmbedding.reduce(
                (acc, val, index) =>
                  acc +
                  Math.pow(val - quorum.quorum[j].reveal!.bEmbedding[index], 2),
                0
              )
            );
    }
  }

  logger.debug(
    `Consensus ${quorum.requestId}: Computed distances for ${quorum.quorum.length} commits`,
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
    `Consensus ${quorum.requestId}: Computed cluster sizes for ${quorum.quorum.length} commits`,
    clusterSizes
  );

  logger.debug(
    `Consensus ${quorum.requestId}: Computed cluster size needed for ${quorum.quorum.length} commits: ${clusterSizeNeeded}`
  );

  const largestSizes = clusterSizes
    .filter((cS) => cS.clusterSize >= clusterSizeNeeded)
    .sort((a, b) => b.clusterSize - a.clusterSize);

  logger.debug(
    `Consensus ${quorum.requestId}: Computed largest cluster sizes for ${quorum.quorum.length} commits`,
    largestSizes
  );

  console.timeEnd(`Computing clusters for ${quorum.quorum.length} commits`);

  if (!largestSizes.length) {
    logger.debug(
      `Consensus ${quorum.requestId}: No clusters found with size ${clusterSizeNeeded} or greater`
    );

    return {
      requestId: quorum.requestId,
      success: false,
      reason: "no_clusters_found_of_needed_size",
      debug: {
        clusterSizeNeeded,
        distances,
      },
      rejectionPackets,
    };
  }

  const largestCluster = largestSizes[0];

  logger.debug(
    `Consensus ${quorum.requestId}: Found largest cluster with size ${largestCluster.clusterSize} at index ${largestCluster.commitIndex}`
  );

  const acceptedInferenceIndices: number[] = distances[
    largestCluster.commitIndex
  ]
    .map((distance, index) =>
      distance >= securityFrame.secDistance ? false : index
    )
    .filter((index) => index !== false) as number[];

  logger.debug(
    `Consensus ${quorum.requestId}: Accepted ${acceptedInferenceIndices.length} inferences for largest cluster`,
    acceptedInferenceIndices
  );

  const acceptedInferences = acceptedInferenceIndices.map(
    (index) => quorum.quorum[index]
  );

  logger.debug(
    `Consensus ${quorum.requestId}: Accepted inferences for largest cluster`,
    acceptedInferences
  );

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

  logger.debug(
    `Consensus ${quorum.requestId}: Computed Final inference quorum`,
    inferenceQuorumComputed
  );

  return {
    rejectionPackets,
    success: true,
    requestId: quorum.requestId,
    reason: "success",
    debug: {
      clusterSizeNeeded,
      distances,
    },
    computedQuorumPacket: inferenceQuorumComputed,
  };
}
