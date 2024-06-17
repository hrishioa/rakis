import { Flex, Button, Box, Tooltip } from "@radix-ui/themes";
import { ChainIdentity } from "../../rakis-core/synthient-chain/db/entities";
import ChainIdentities from "./chainidentities";
import ScaleWorkers from "./scaleWorkers";
import {
  LLMModelName,
  LLMWorkerStates,
} from "../../rakis-core/synthient-chain/llm/types";

export default function NavBar({
  llmWorkerStates,
  mySynthientId,
  scaleLLMWorkers,
  chainIdentities,
  addNewChainIdentity,
}: {
  llmWorkerStates: LLMWorkerStates;
  mySynthientId: string;
  scaleLLMWorkers: (modelName: LLMModelName, numWorkers: number) => void;
  chainIdentities: ChainIdentity[];
  addNewChainIdentity: (
    signature: `0x${string}`,
    chain: string,
    signedWithWallet: string
  ) => Promise<void>;
}) {
  return (
    <Flex direction={{ initial: "column", sm: "row" }} justify="center" gap="2">
      <Tooltip content={`${mySynthientId}`}>
        <Button variant="ghost" size="3">
          You are {mySynthientId.slice(0, 10)}
        </Button>
      </Tooltip>
      <Box flexGrow="1"></Box>
      <ScaleWorkers
        workerCount={Object.keys(llmWorkerStates)
          .map((workerId) => llmWorkerStates[workerId].modelName)
          .reduce((acc, cur) => {
            acc[cur] ??= 0;
            acc[cur]++;
            return acc;
          }, {} as { [key: string]: number })}
        scaleLLMWorkers={scaleLLMWorkers}
      />
      <ChainIdentities
        chainIdentities={chainIdentities}
        synthientId={mySynthientId}
        addNewChainIdentity={addNewChainIdentity}
      />
    </Flex>
  );
}
