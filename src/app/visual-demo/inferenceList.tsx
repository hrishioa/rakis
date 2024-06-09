import React, { useState } from "react";
import { InferencesForDisplay } from "./useTheDomain";

const InferenceCard: React.FC<{ inference: InferencesForDisplay }> = ({
  inference,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-4 hover:bg-gray-50 transition-colors">
      <div
        className="flex justify-between items-center cursor-pointer"
        onClick={() => setIsOpen(!isOpen)}
      >
        <h3 className="text-xl font-semibold text-blue-600">
          {inference.requestId}
        </h3>
        <span className="text-sm text-gray-500">
          {new Date(inference.requestedAt).toLocaleString()}
        </span>
      </div>
      <div className="mt-4 space-y-2">
        {inference.endingAt > new Date() ? (
          <p>
            <strong>Ending in:</strong>
            <span className="text-red-500">
              {" "}
              {((inference.endingAt.getTime() - Date.now()) / 1000).toFixed(
                0
              )}{" "}
              seconds
            </span>
          </p>
        ) : (
          <p>
            <strong>Ended At:</strong>{" "}
            <span className="text-green-500">
              {inference.endingAt.toLocaleString()}
            </span>
          </p>
        )}
        <p>
          <strong>From Chain:</strong> {inference.requestPayload.fromChain}
        </p>
        <p>
          <strong>Prompt:</strong> {inference.requestPayload.prompt}
        </p>
        <p>
          <strong>Accepted Models:</strong>{" "}
          {inference.requestPayload.acceptedModels.join(", ")}
        </p>
      </div>
      {isOpen && (
        <div className="mt-6 space-y-4">
          {inference.ourResult && (
            <div className="mb-4 p-4 border-l-4 border-blue-400 bg-gray-100 rounded">
              <h4 className="text-lg font-semibold text-indigo-700">
                Our Result
              </h4>
              <p>
                <strong>Inference ID:</strong>{" "}
                {inference.ourResult.payload.inferenceId}
              </p>
              <p>
                <strong>Started At:</strong>{" "}
                {new Date(
                  inference.ourResult.payload.startedAt
                ).toLocaleString()}
              </p>
              <p>
                <strong>Completed At:</strong>{" "}
                {new Date(
                  inference.ourResult.payload.completedAt
                ).toLocaleString()}
              </p>
              {inference.ourResult.payload.result.success ? (
                <>
                  <p>
                    <strong>Result:</strong>{" "}
                    {inference.ourResult.payload.result.result}
                  </p>
                  <p>
                    <strong>Token Count:</strong>{" "}
                    {inference.ourResult.payload.result.tokenCount}
                  </p>
                </>
              ) : (
                <p>
                  <strong>Error:</strong>{" "}
                  {JSON.stringify(inference.ourResult.payload.result.error)}
                </p>
              )}
              {inference.ourResult.bEmbeddingHash && (
                <p>
                  <strong>B Embedding Hash:</strong>{" "}
                  {inference.ourResult.bEmbeddingHash}
                </p>
              )}
            </div>
          )}
          {inference.quorum && (
            <div className="mb-4 p-4 border-l-4 border-green-400 bg-gray-100 rounded">
              <h4 className="text-lg font-semibold text-teal-700">Quorum</h4>
              <p>
                <strong>Status:</strong> {inference.quorum.status}
              </p>
              <p>
                <strong>Quorum Threshold:</strong>{" "}
                {inference.quorum.quorumThreshold}
              </p>
              <p>
                <strong>Quorum Committed:</strong>{" "}
                {inference.quorum.quorumCommitted}
              </p>
              <p>
                <strong>Quorum Revealed:</strong>{" "}
                {inference.quorum.quorumRevealed}
              </p>
              <h5 className="text-md font-semibold mt-4">Quorum Details</h5>
              <ul className="list-disc pl-5">
                {inference.quorum.quorum.map((item, index) => (
                  <li key={index}>
                    <p>
                      <strong>Inference ID:</strong> {item.inferenceId}
                    </p>
                    <p>
                      <strong>Synthient ID:</strong> {item.synthientId}
                    </p>
                    <p>
                      <strong>Commit Received At:</strong>{" "}
                      {item.commitReceivedAt.toLocaleString()}
                    </p>
                    <p>
                      <strong>B Embedding Hash:</strong> {item.bEmbeddingHash}
                    </p>
                    {item.reveal && (
                      <>
                        <p>
                          <strong>Output:</strong> {item.reveal.output}
                        </p>
                        <p>
                          <strong>Received At:</strong>{" "}
                          {item.reveal.receivedAt.toLocaleString()}
                        </p>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {inference.consensusResult && (
            <div className="p-4 border-l-4 border-orange-400 bg-gray-100 rounded">
              <h4 className="text-lg font-semibold text-orange-700">
                Consensus Result
              </h4>
              <p>
                <strong>Status:</strong> {inference.consensusResult.status}
              </p>
              {inference.consensusResult.result && (
                <>
                  <p>
                    <strong>Submitted Inferences:</strong>{" "}
                    {inference.consensusResult.result.submittedInferences
                      .map((i) => i.inferenceId)
                      .join(", ")}
                  </p>
                  <p>
                    <strong>Valid Inferences:</strong>{" "}
                    {inference.consensusResult.result.validInferences
                      .map((i) => i.inferenceId)
                      .join(", ")}
                  </p>
                  <p>
                    <strong>Valid Inference Joint Hash:</strong>{" "}
                    {inference.consensusResult.result.validInferenceJointHash}
                  </p>
                  <h5 className="text-md font-semibold mt-4">
                    Valid Inference
                  </h5>
                  <p>
                    <strong>Output:</strong>{" "}
                    {inference.consensusResult.result.validInference.output}
                  </p>
                  <p>
                    <strong>From Synthient ID:</strong>{" "}
                    {
                      inference.consensusResult.result.validInference
                        .fromSynthientId
                    }
                  </p>
                  <p>
                    <strong>B Embedding Hash:</strong>{" "}
                    {
                      inference.consensusResult.result.validInference
                        .bEmbeddingHash
                    }
                  </p>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const InferenceList: React.FC<{ inferences: InferencesForDisplay[] }> = ({
  inferences,
}) => {
  return (
    <div className="lg:h-[50vh] overflow-y-auto">
      <h2 className="text-2xl font-bold mb-4 text-gray-700">Inferences</h2>
      {inferences.map((inference, index) => (
        <InferenceCard key={index} inference={inference} />
      ))}
    </div>
  );
};

export default InferenceList;
