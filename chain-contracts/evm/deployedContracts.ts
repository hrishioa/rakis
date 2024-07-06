import { arbitrum, polygon, sepolia } from "viem/chains";

export const DEPLOYED_AI_CONTRACTS: {
  [chainId: number]: {
    chainName: string;
    AIContractAddress: `0x${string}`;
  };
} = {
  [sepolia.id]: {
    chainName: "Sepolia",
    AIContractAddress: "0x75afD2ac2C3a93aAB78D5Ca7321Aa36C7CD513FD",
  },
  [polygon.id]: {
    chainName: "Polygon",
    AIContractAddress: "0x44e7B198A62f2336B00ae70E17cb478e2936c258",
  },
  [arbitrum.id]: {
    chainName: "Arbitrum",
    AIContractAddress: "0xbddFCCe1C7ee5Ee281e51D66F4Bb219E4c335814",
  },
} as const;

export const DEFAULT_CHAIN_ID = polygon.id;
