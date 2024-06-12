import { createConfig, http } from "wagmi";
import { mainnet, sepolia, polygon, arbitrum, avalanche } from "wagmi/chains";
import { metaMask } from "wagmi/connectors";
import { loadSettings } from "../../rakis-core/synthient-chain/thedomain/settings";

const chainConnectionSettings = loadSettings().chainConnectionSettings;

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
        name: chainConnectionSettings.dAppName,
        url: chainConnectionSettings.url,
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
