"use client";
import { useEffect, useId, useRef } from "react";
import { setupNostr } from "../../core/p2p/nostr-test";
import { setupNkn } from "../../core/p2p/nkn-test";

const P2PTestPage: React.FC = () => {
  const nostrStarted = useRef(false);
  const nknStarted = useRef(false);
  const wakuStarted = useRef(false);

  const nodeName = useId();

  useEffect(() => {
    if (!nostrStarted.current) {
      nostrStarted.current = true;
      console.log("Starting Nostr");
      setupNostr(nodeName);
    }
  }, []);

  useEffect(() => {
    if (!nknStarted.current) {
      nknStarted.current = true;
      console.log("Starting NKN");
      setupNkn(nodeName);
    }
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      (window as any).send = (message: string) => {
        if ((window as any).sendNknMessage)
          (window as any).sendNknMessage(message);
        if ((window as any).sendTrysteroMessage)
          (window as any).sendTrysteroMessage(message);
      };
    }
  });

  // useEffect(() => {
  //   if (!wakuStarted.current) {
  //     wakuStarted.current = true;
  //     console.log("Starting Waku");
  //     setupWaku(nodeName);
  //   }
  // }, []);

  return (
    <div>
      <h1>P2P Test - {nodeName}</h1>
    </div>
  );
};

export default P2PTestPage;
