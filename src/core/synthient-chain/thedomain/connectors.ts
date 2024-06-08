import { InferenceDB } from "../db/inferencedb";
import {
  InferenceCommit,
  InferenceEmbedding,
  InferenceReveal,
  InferenceRevealRequest,
  P2PInferenceRequestPacket,
  PeerPacket,
  ReceivedPeerPacket,
} from "../db/packet-types";
import { PacketDB } from "../db/packetdb";
import { SynthientLogger } from "../utils/logger";
import { stringifyDateWithOffset } from "../utils/utils";

export function saveInferencePacketsFromP2PToInferenceDB(
  packetDB: PacketDB,
  inferenceDB: InferenceDB,
  logger: SynthientLogger
) {
  // Send received peer-based inference requests from packetdb to inferencedb
  // TODO: This should be depreated later so we don't have a cycle in our
  // data flow

  const inferenceRequestListener = (packet: P2PInferenceRequestPacket) => {
    logger.debug("Saving p2p inference request to our db");
    setTimeout(
      () =>
        inferenceDB.saveInferenceRequest({
          fetchedAt: new Date(),
          requestId: packet.requestId,
          payload: packet.payload,
        }),
      0
    );
  };

  const inferenceCommitListener = (
    packet: Omit<ReceivedPeerPacket, "packet"> & {
      packet: InferenceCommit;
    }
  ) => {
    setTimeout(() => {
      logger.debug("Processing new inference commit");
      inferenceDB.saveInferenceCommit(packet);
    }, 0);
  };

  const inferenceRevealRequestListener = (
    packet: Omit<ReceivedPeerPacket, "packet"> & {
      packet: InferenceRevealRequest;
    }
  ) => {
    setTimeout(() => {
      logger.debug("Processing new inference reveal request");
      inferenceDB.processInferenceRevealRequest(packet);
    }, 0);
  };

  const inferenceRevealListener = (
    packet: Omit<ReceivedPeerPacket, "packet"> & {
      packet: InferenceReveal;
    }
  ) => {
    setTimeout(() => {
      logger.debug("Processing new inference reveal");
      inferenceDB.processInferenceReveal(packet);
    }, 0);
  };

  packetDB.on("newP2PInferenceRequest", inferenceRequestListener);
  packetDB.on("newInferenceCommit", inferenceCommitListener);
  packetDB.on("newInferenceRevealRequest", inferenceRevealRequestListener);
  packetDB.on("newInferenceRevealed", inferenceRevealListener);

  return () => {
    packetDB.removeListener("newP2PInferenceRequest", inferenceRequestListener);
    packetDB.removeListener("newInferenceCommit", inferenceCommitListener);
    packetDB.removeListener(
      "newInferenceRevealRequest",
      inferenceRevealRequestListener
    );
    packetDB.removeListener("newInferenceRevealed", inferenceRevealListener);
  };
}

export function propagateInferencePacketsFromInferenceDBtoP2P(
  packetDB: PacketDB,
  inferenceDB: InferenceDB,
  logger: SynthientLogger
) {
  const publishInferenceEmbeddings = (
    inferenceEmbedding: InferenceEmbedding
  ) => {
    setTimeout(() => {
      logger.debug("New inference embedding, committing to result");
      packetDB.transmitPacket({
        type: "inferenceCommit",
        bEmbeddingHash: inferenceEmbedding.bEmbeddingHash,
        requestId: inferenceEmbedding.requestId,
        inferenceId: inferenceEmbedding.inferenceId,
        createdAt: stringifyDateWithOffset(new Date()),
      });
    }, 0);
  };

  const publishQuorumRevealRequests = (
    revealRequests: InferenceRevealRequest[]
  ) => {
    setTimeout(() => {
      logger.debug("Publishing reveal requests");
      revealRequests.forEach((revealRequest) => {
        packetDB.transmitPacket(revealRequest);
      });
    }, 0);
  };

  const publishInferenceReveals = (inferenceReveal: InferenceReveal) => {
    setTimeout(() => {
      logger.debug("Publishing revealed inference");
      packetDB.transmitPacket(inferenceReveal);
    }, 0);
  };

  const publishConsensusPackets = (consensusPackets: PeerPacket[]) => {
    consensusPackets.forEach((packet) => {
      setTimeout(() => {
        logger.debug("New consensus packets, propagating");
        packetDB.transmitPacket(packet);
      }, 0);
    });
  };

  // If embeddings are done, send out the commit message
  inferenceDB.on("newInferenceEmbedding", publishInferenceEmbeddings);

  // When quorums are ready to be revealed, propagate the requests
  inferenceDB.on("requestQuorumReveal", publishQuorumRevealRequests);

  inferenceDB.on("revealedInference", publishInferenceReveals);

  // Once consensus happens, propagate the consensus packets
  // TODO: IMPORTANT Do we save other peoples consensus packets? Maybe if there's not a collision, or save all for posterity?
  inferenceDB.quorumDb.on("consensusPackets", publishConsensusPackets);

  return () => {
    inferenceDB.removeListener(
      "newInferenceEmbedding",
      publishInferenceEmbeddings
    );
    inferenceDB.removeListener(
      "requestQuorumReveal",
      publishQuorumRevealRequests
    );
    inferenceDB.removeListener("revealedInference", publishInferenceReveals);
    inferenceDB.quorumDb.removeListener(
      "consensusPackets",
      publishConsensusPackets
    );
  };
}
