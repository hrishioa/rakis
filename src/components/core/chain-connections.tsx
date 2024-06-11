"use client";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { Button } from "../ui/button";
import { useEffect } from "react";
import { Label } from "../ui/label";

const ChainConnections: React.FC = () => {
  const { connectors, connect } = useConnect();
  const { address } = useAccount();
  const { disconnect } = useDisconnect();

  useEffect(() => {
    console.log("Got chain connectors ", connectors);
  }, [connectors]);

  return address ? (
    <div className="flex flex-row items-center space-x-4 justify-end">
      <Label htmlFor="disconnectBtn">
        Connected to {address.slice(0, 20)}...
      </Label>
      <Button id="disconnectBtn" onClick={() => disconnect()}>
        Disconnect
      </Button>
    </div>
  ) : (
    <div className="flex flex-row items-center space-x-4 justify-end">
      <span className="mr-2 pt-2">Connect </span>
      {connectors
        .filter((connector) => connector.type === "injected")
        .map((connector) => (
          <Button key={connector.uid} onClick={() => connect({ connector })}>
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
  );
};

export default ChainConnections;
