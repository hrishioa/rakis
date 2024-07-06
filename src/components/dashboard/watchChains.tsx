import { Button, Text } from "@radix-ui/themes";
import React, { useEffect, useState } from "react";
import { useAccount, useSwitchChain, useWatchContractEvent } from "wagmi";
import {
  DEFAULT_CHAIN_ID,
  DEPLOYED_AI_CONTRACTS,
} from "../../../chain-contracts/evm/deployedContracts";
import { AIContractABI } from "../../../chain-contracts/evm/AIContract.abi";
import { useSubmitChainInferenceRequest } from "../../hooks/useSubmitChainInferenceRequest";

const WatchChain: React.FC<{
  chainId: number;
  separator: boolean;
  AIContractAddress: `0x${string}`;
  chainName: string;
}> = ({ chainId, AIContractAddress, separator, chainName }) => {
  const submitChainInferenceRequest = useSubmitChainInferenceRequest();

  useWatchContractEvent({
    chainId: chainId as any,
    address: AIContractAddress,
    abi: AIContractABI,
    eventName: "NewRequest",
    onLogs: (logs) => {
      console.log(`🎉🎉🎉🎉 NewRequest Received from ${chainName}:`, logs);

      logs.map((log) => {
        if (
          log.args.caller &&
          log.args.invocationId &&
          log.args.maxOutputTokens &&
          log.args.model &&
          log.args.prompt
        ) {
          submitChainInferenceRequest(
            log.args.caller,
            log.args.prompt,
            log.args.model,
            log.blockNumber.toString(),
            Number(log.args.maxOutputTokens),
            chainName,
            chainId,
            log.transactionHash,
            Number(log.args.invocationId)
          );
        }
      });
    },
  });

  return (
    <Text my="2">
      {chainName}
      {separator ? ", " : ""}
    </Text>
  );
};

export default function WatchChains() {
  return (
    <Text size="1" weight="bold" color="grass">
      listening on{" "}
      {Object.entries(DEPLOYED_AI_CONTRACTS).map(
        ([chainId, { chainName, AIContractAddress }], index) => (
          <WatchChain
            key={chainId}
            separator={index < Object.keys(DEPLOYED_AI_CONTRACTS).length - 1}
            chainId={Number(chainId)}
            AIContractAddress={AIContractAddress}
            chainName={chainName}
          />
        )
      )}
    </Text>
  );
}

// export default function WatchChains() {
//   const { isConnected, chain } = useAccount();
//   const [watchState, setWatchState] = useState<
//     "not_connected" | "switch_chains" | "listening"
//   >("not_connected");
//   const [chainName, setChainName] = useState<string | null>(null);
//   const { switchChain } = useSwitchChain();

//   useEffect(() => {
//     if (isConnected && chain) {
//       if (DEPLOYED_AI_CONTRACTS[chain.id]) {
//         setWatchState("listening");
//         setChainName(DEPLOYED_AI_CONTRACTS[chain.id].chainName);
//       } else {
//         setWatchState("switch_chains");
//       }
//     }
//   }, [isConnected, chain]);

//   return watchState === "switch_chains" ? (
//     <Button
//       size="1"
//       onClick={() => {
//         switchChain({ chainId: DEFAULT_CHAIN_ID });
//       }}
//     >
//       Switch chains to listen for requests
//     </Button>
//   ) : watchState === "listening" ? (
//     <Text size="1" weight="bold" color="grass">
//       Listening on {chainName}
//     </Text>
//   ) : null;
// }
