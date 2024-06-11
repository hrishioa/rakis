import { createConfig, http } from "wagmi";
import { mainnet, sepolia, polygon, arbitrum, avalanche } from "wagmi/chains";

declare module "wagmi" {
  interface Register {
    config: typeof config;
  }
}

export const config = createConfig({
  chains: [mainnet, sepolia, polygon, arbitrum, avalanche],
  transports: {
    [mainnet.id]: http(),
    [sepolia.id]: http(),
    [polygon.id]: http(),
    [arbitrum.id]: http(),
    [avalanche.id]: http(),
  },
});
