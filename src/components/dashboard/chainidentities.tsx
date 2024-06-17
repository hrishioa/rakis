"use client";
import {
  Connector,
  useAccount,
  useConnect,
  useDisconnect,
  useSignMessage,
} from "wagmi";
import { useEffect, useRef } from "react";
import { ChainIdentity } from "../../rakis-core/synthient-chain/db/entities";
import { Badge, Button, Flex, Popover, Tooltip } from "@radix-ui/themes";

const ChainIdentities: React.FC<{
  chainIdentities: ChainIdentity[];
  synthientId: string;
  addNewChainIdentity: (
    signature: `0x${string}`,
    chain: string,
    signedWithWallet: string
  ) => Promise<void>;
}> = ({ chainIdentities, synthientId, addNewChainIdentity }) => {
  const { connectors, connect } = useConnect();
  const { address, isConnected, connector, chain } = useAccount();
  const { disconnect } = useDisconnect();
  const { signMessageAsync } = useSignMessage();
  const signatureInProgress = useRef(false);

  function getFilteredConnectors(connectors: readonly Connector[]) {
    const firstPartyConnectors = connectors.filter(
      (connector) => connector.type === "injected"
    );

    if (firstPartyConnectors.length) {
      return firstPartyConnectors;
    } else {
      return connectors;
    }
  }

  useEffect(() => {
    if (
      isConnected &&
      address &&
      !chainIdentities.find((identity) => identity.address === address) &&
      !signatureInProgress.current
    ) {
      signatureInProgress.current = true;

      console.log("Waiting to connect identity");

      (async () => {
        console.log("Connecting a new identity ", address);

        try {
          const signatureRes = await signMessageAsync({
            account: address,
            message: synthientId,
          });

          console.log("Got signature ", signatureRes);

          if (signatureRes) {
            await addNewChainIdentity(
              signatureRes,
              chain?.name || "unknown",
              connector?.name || "unknown"
            );
          }

          disconnect();
        } catch (err) {
          console.error("Could not sign message", err);
        }
      })();
    }
  }, [
    address,
    chain,
    isConnected,
    synthientId,
    addNewChainIdentity,
    disconnect,
    signMessageAsync,
    chainIdentities,
    connector,
  ]);

  return (
    <Tooltip
      content={
        chainIdentities && chainIdentities.length
          ? chainIdentities
              .map((identity) => (
                <div key={identity.address + identity.chain}>
                  <Badge>{identity.chain}</Badge>
                  <p>
                    {identity.address.slice(0, 10)}...
                    {identity.address.slice(-10)}
                  </p>
                </div>
              ))
              .join("\n")
          : "Click to add an identity"
      }
    >
      <Popover.Root>
        <Popover.Trigger>
          <Button color="grass" variant="soft" size="3">
            Connect On-Chain Identity{" "}
            {chainIdentities.length ? `(${chainIdentities.length})` : ""}
          </Button>
        </Popover.Trigger>
        <Popover.Content>
          <Flex direction="column" gap="2">
            {getFilteredConnectors(connectors).map((connector) => (
              <Button
                size="4"
                variant="surface"
                key={connector.uid}
                onClick={() => connect({ connector })}
              >
                {connector.icon && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={connector.icon}
                    alt={connector.name}
                    className="mr-2 h-4 w-4"
                  />
                )}
                {connector.name}
              </Button>
            ))}
            {chainIdentities.map((identity, index) => (
              <Badge key={index} size="2">
                {identity.chain}: {identity.address.slice(0, 10)}...
                {identity.address.slice(-10)}
              </Badge>
            ))}
          </Flex>
        </Popover.Content>
      </Popover.Root>
    </Tooltip>
  );
};

export default ChainIdentities;
