"use client";
import { useEffect, useId, useRef, useState } from "react";
import { createWorkerFactory, useWorker } from "@shopify/react-web-worker";
import { Card } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Textarea } from "../../components/ui/textarea";
import { Button } from "../../components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@radix-ui/react-tabs";
import { Separator } from "../../components/ui/separator";

const nostrWorkerFactory = createWorkerFactory(
  () => import("../../core/p2p/nostr-test")
);

const wakuWorkerFactory = createWorkerFactory(
  () => import("../../core/p2p/waku-test")
);

const nknWorkerFactory = createWorkerFactory(
  () => import("../../core/p2p/nkn-test")
);

const P2PTestPage: React.FC = () => {
  const nostrWorker = useWorker(nostrWorkerFactory);
  const wakuWorker = useWorker(wakuWorkerFactory);
  const nknWorker = useWorker(nknWorkerFactory);

  const workersStarted = useRef(false);

  const [globalMessage, setGlobalMessage] = useState("");
  const [messages, setMessages] = useState<Record<string, string[]>>({
    nostr: [],
    waku: [],
    nkn: [],
  });
  const [peers, setPeers] = useState<Record<string, string[]>>({
    nostr: [],
    waku: [],
    nkn: [],
  });

  const nodeName = useId();

  useEffect(() => {
    const pollPeers = async () => {
      const nostrPeers = await nostrWorker.getPeers();
      const nknPeers = await nknWorker.getSubscribers();
      const wakuPeers = await wakuWorker.getWakuPeers();

      const newPeers = peers;

      if (nostrPeers) newPeers.nostr = nostrPeers;
      if (nknPeers) newPeers.nkn = nknPeers;
      if (wakuPeers.connectedPeers)
        newPeers.waku = wakuPeers.connectedPeers.map(
          (peerId) => peerId.publicKey?.toString() || ""
        );

      setPeers(newPeers);
    };

    const pollInterval = setInterval(pollPeers, 5000); // Poll every 5 seconds

    return () => {
      clearInterval(pollInterval);
    };
  }, [nostrWorker, nknWorker, wakuWorker]);

  useEffect(() => {
    if (workersStarted.current) return;
    workersStarted.current = true;

    // Initialize workers and set up event listeners
    // TODO: You need to make sure (using a mutex) that this doesn't happen twice
    nostrWorker.setupNostr(nodeName);
    nknWorker.setupNkn(nodeName);
    wakuWorker.setupWaku(nodeName);

    // Set up global send function
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
  }, [nodeName, nostrWorker, nknWorker, wakuWorker]);

  const handleSendGlobal = () => {
    if (typeof window !== "undefined") {
      (window as any).send(globalMessage);
      setGlobalMessage("");
    }
  };

  const handleSendNostr = () => {
    if (typeof window !== "undefined") {
      (window as any).sendTrysteroMessage(globalMessage);
      setGlobalMessage("");
    }
  };

  const handleSendNkn = () => {
    if (typeof window !== "undefined") {
      (window as any).sendNknMessage(globalMessage);
      setGlobalMessage("");
    }
  };

  const handleSendWaku = () => {
    if (typeof window !== "undefined") {
      (window as any).sendWakuMessage(globalMessage);
      setGlobalMessage("");
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold mb-8">P2P Test - {nodeName}</h1>

      <Card className="mb-8">
        <Tabs defaultValue="nostr">
          <TabsList>
            <TabsTrigger value="nostr">Nostr</TabsTrigger>
            <TabsTrigger value="nkn">NKN</TabsTrigger>
            <TabsTrigger value="waku">Waku</TabsTrigger>
          </TabsList>
          <TabsContent value="nostr">
            <div className="mb-4">
              <h2 className="text-2xl font-bold mb-2">Nostr Status</h2>
              <p>Connected Peers: {peers.nostr.join(", ")}</p>
            </div>
            <div>
              <h2 className="text-2xl font-bold mb-2">Nostr Messages</h2>
              <Textarea
                className="mb-4"
                readOnly
                rows={10}
                value={messages.nostr.join("\n")}
              />
              <Input
                className="mb-2"
                placeholder="Message"
                value={globalMessage}
                onChange={(e) => setGlobalMessage(e.target.value)}
              />
              <Button onClick={handleSendNostr}>Send Nostr Message</Button>
            </div>
          </TabsContent>
          <TabsContent value="nkn">
            <div className="mb-4">
              <h2 className="text-2xl font-bold mb-2">NKN Status</h2>
              <p>Connected Peers: {peers.nkn.join(", ")}</p>
            </div>
            <div>
              <h2 className="text-2xl font-bold mb-2">NKN Messages</h2>
              <Textarea
                className="mb-4"
                readOnly
                rows={10}
                value={messages.nkn.join("\n")}
              />
              <Input
                className="mb-2"
                placeholder="Message"
                value={globalMessage}
                onChange={(e) => setGlobalMessage(e.target.value)}
              />
              <Button onClick={handleSendNkn}>Send NKN Message</Button>
            </div>
          </TabsContent>
          <TabsContent value="waku">
            <div className="mb-4">
              <h2 className="text-2xl font-bold mb-2">Waku Status</h2>
              <p>Connected Peers: {peers.waku.join(", ")}</p>
            </div>
            <div>
              <h2 className="text-2xl font-bold mb-2">Waku Messages</h2>
              <Textarea
                className="mb-4"
                readOnly
                rows={10}
                value={messages.waku.join("\n")}
              />
              <Input
                className="mb-2"
                placeholder="Message"
                value={globalMessage}
                onChange={(e) => setGlobalMessage(e.target.value)}
              />
              <Button onClick={handleSendWaku}>Send Waku Message</Button>
            </div>
          </TabsContent>
        </Tabs>
      </Card>

      <Separator className="my-8" />

      <Card>
        <h2 className="text-2xl font-bold mb-4">Global Message</h2>
        <Input
          className="mb-4"
          placeholder="Message"
          value={globalMessage}
          onChange={(e) => setGlobalMessage(e.target.value)}
        />
        <Button onClick={handleSendGlobal}>Send to All Networks</Button>
      </Card>
    </div>
  );
};

export default P2PTestPage;
