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

export const chainColors = [
  "--grass-11",
  "--purple-11",
  "--sky-11",
  "--red-11",
  "--yellow-11",
];

export const wagmiConfig = createConfig({
  chains: [mainnet, sepolia, polygon, arbitrum, avalanche],
  connectors: [
    metaMask({
      infuraAPIKey: "72b3ae4778aa43999ded12a37ade57d9",
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
