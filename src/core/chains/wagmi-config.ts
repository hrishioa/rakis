import { createConfig, http } from "wagmi";
import { mainnet, sepolia, polygon, arbitrum, avalanche } from "wagmi/chains";
import { metaMask } from "wagmi/connectors";
import { CHAIN_CONNECTION_SETTINGS } from "../synthient-chain/thedomain/settings";

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}

export const wagmiConfig = createConfig({
  chains: [mainnet, sepolia, polygon, arbitrum, avalanche],
  connectors: [
    metaMask({
      dappMetadata: {
        name: CHAIN_CONNECTION_SETTINGS.dAppName,
        url: CHAIN_CONNECTION_SETTINGS.url,
      },
    }),
  ],
  transports: {
    [mainnet.id]: http(),
    [sepolia.id]: http(),
    [polygon.id]: http(),
    [arbitrum.id]: http(),
    [avalanche.id]: http(),
  },
});
