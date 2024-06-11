"use client";
import {
  Connector,
  useAccount,
  useConnect,
  useDisconnect,
  useSignMessage,
} from "wagmi";
import { Button } from "../ui/button";
import { useEffect, useRef } from "react";
import { Label } from "../ui/label";
import { ChainIdentity } from "../../rakis-core/synthient-chain/db/entities";
import { Badge } from "../ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";

const ChainConnections: React.FC<{
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

  useEffect(() => {
    console.log("Got chain connectors ", connectors);
  }, [connectors]);

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
    <div className="flex flex-row items-center space-x-4 space-between">
      {(chainIdentities.length && (
        <div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline">
                  {chainIdentities.length} identit
                  {chainIdentities.length > 1 ? "ies" : "y"} connected
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {chainIdentities.map((identity) => (
                  <div key={identity.address + identity.chain}>
                    <Badge>{identity.chain}</Badge>
                    <p>
                      {identity.address.slice(0, 10)}...
                      {identity.address.slice(-10)}
                    </p>
                  </div>
                ))}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      )) ||
        null}
      {address ? (
        <div className="flex flex-row items-center space-x-4 justify-end">
          <Label htmlFor="disconnectBtn">
            Connected to {address.slice(0, 20)}...
          </Label>
          <Button id="disconnectBtn" onClick={() => disconnect()}>
            Disconnect
          </Button>
        </div>
      ) : (
        (getFilteredConnectors(connectors).length && (
          <div className="flex flex-grow space-x-4 justify-end">
            <span className="mr-2 pt-2">Connect New </span>
            {getFilteredConnectors(connectors).map((connector) => (
              <Button
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
          </div>
        )) ||
        null
      )}
    </div>
  );

  return;
};

export default ChainConnections;
