"use client";
import { useEffect, useId, useRef } from "react";
import { setupNostr } from "../../core/p2p/nostr-test";
import { setupNkn } from "../../core/p2p/nkn-test";
import { setupWaku } from "../../core/p2p/waku-test";
import {
  createPlainWorkerFactory,
  createWorkerFactory,
  useWorker,
} from "@shopify/react-web-worker";

const nostrWorkerFactory = createWorkerFactory(
  () => import("../../core/p2p/nostr-test")
);

const wakuWorkerFactory = createWorkerFactory(
  () => import("../../core/p2p/waku-test")
);

const nknWorkerFactory = createWorkerFactory(
  () => import("../../core/p2p/nkn-test")
);

const plainNostrWorkerFactor = createPlainWorkerFactory(
  () => import("../../core/p2p/nostr-test")
);

const P2PTestPage: React.FC = () => {
  const nostrWorker = useWorker(nostrWorkerFactory);
  const wakuWorker = useWorker(wakuWorkerFactory);
  const nknWorker = useWorker(nknWorkerFactory);

  const nostrStarted = useRef(false);
  const nknStarted = useRef(false);
  const wakuStarted = useRef(false);

  const nodeName = useId();

  useEffect(() => {
    if (!nostrStarted.current) {
      nostrStarted.current = true;
      console.log("Starting Nostr");
      nostrWorker.setupNostr(nodeName);
    }
  }, [nodeName, nostrWorker]);

  useEffect(() => {
    if (!nknStarted.current) {
      nknStarted.current = true;
      console.log("Starting NKN");
      nknWorker.setupNkn(nodeName);
    }
  }, [nodeName, nknWorker]);

  useEffect(() => {
    if (!wakuStarted.current) {
      wakuStarted.current = true;
      console.log("Starting Waku");
      wakuWorker.setupWaku(nodeName);
    }
  }, [nodeName, wakuWorker]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      (window as any).send = (message: string) => {
        if ((window as any).sendNknMessage)
          (window as any).sendNknMessage(message);
        if ((window as any).sendTrysteroMessage)
          (window as any).sendTrysteroMessage(message);
        if ((window as any).sendWakuMessage)
          (window as any).sendWakuMessage(message);
      };
    }
  });

  return (
    <div>
      <h1>P2P Test - {nodeName}</h1>
    </div>
  );
};

export default P2PTestPage;
