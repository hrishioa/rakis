"use client";

import Lottie from "react-lottie";
import { useTheDomain } from "../../../components/core/useTheDomain";
import * as sandwormAnimationData from "../../../components/core/sandworms.json";

export default function Dashboard({
  password,
  overwrite,
}: {
  password: string;
  overwrite: boolean;
}) {
  const {
    peers,
    packets,
    llmEngineLog,
    llmWorkerStates,
    mySynthientId,
    scaleLLMWorkers,
    inferences,
    submitInferenceRequest,
    peerCount,
    chainIdentities,
    addNewChainIdentity,
  } = useTheDomain(password, overwrite);

  return (
    (mySynthientId && <div>Activated synthient</div>) || (
      <div className=" h-dvh w-full flex justify-center items-center">
        <div className="w-1/4">
          <Lottie
            options={{
              loop: true,
              autoplay: true,
              animationData: sandwormAnimationData,
              rendererSettings: {
                preserveAspectRatio: "xMidYMid slice",
              },
            }}
            style={{
              width: "100%",
              height: "auto",
            }}
          />
        </div>
      </div>
    )
  );
}
