import { useState, useEffect, useRef } from "react";
import {
  bytesToUtf8,
  createDecoder,
  createEncoder,
  createLightNode,
  DecodedMessage,
  LightNode,
  Protocols,
  utf8ToBytes,
  waitForRemotePeer,
} from "@waku/sdk";
import { wakuPeerExchangeDiscovery } from "@waku/discovery";

const ContentTopic = "/zensu/3/json";
const PubsubTopic = "/waku/2/default-waku/proto";

const NODE_CONFIG = {
  contentTopics: [ContentTopic],
  pubsubTopics: [PubsubTopic],
  defaultBootstrap: false,
  bootstrapPeers: [
    "/dns4/waku.myrandomdemos.online/tcp/8000/wss/p2p/16Uiu2HAmKfC2QUvMVyBsVjuEzdo1hVhRddZxo69YkBuXYvuZ83sc",
    "/dns4/node-01.do-ams3.wakuv2.prod.status.im/tcp/8000/wss/p2p/16Uiu2HAmL5okWopX7NqZWBUKVqW8iUxCEmd5GMHLVPwCgzYzQv3e",
    "/dns4/node-01.gc-us-central1-a.wakuv2.prod.statusim.net/tcp/8000/wss/p2p/16Uiu2HAmVkKntsECaYfefR1V2yCR79CegLATuTPE6B9TxgxBiiiA",
    "/dns4/node-01.ac-cn-hongkong-c.wakuv2.prod.status.im/tcp/8000/wss/p2p/16Uiu2HAm4v86W3bmT1BiH6oSPzcsSr24iDQpSN5Qa992BCjjwgrD",
    "/dns4/node-01.do-ams3.wakuv2.test.status.im/tcp/8000/wss/p2p/16Uiu2HAmPLe7Mzm8TsYUubgCAW1aJoeFScxrLj8ppHFivPo97bUZ",
  ],
  libp2p: {
    peerDiscovery: [wakuPeerExchangeDiscovery([PubsubTopic])],
  },
};

type Message = {
  type: "message";
  data: any;
  peerId: string;
  timestamp: number;
};

type Event = {
  type: "peerConnected" | "log";
  data: any;
  timestamp: number;
};

type MessagesState = {
  messages: Message[];
  events: Event[];
  connectedPeers: string[];
};

function useWaku(wakuIdentifier: string) {
  const [wakuNode, setWakuNode] = useState<LightNode | undefined>();
  const mutex = useRef(false);
  const [messagesState, setMessagesState] = useState<MessagesState>({
    messages: [],
    events: [],
    connectedPeers: [],
  });

  useEffect(() => {
    const setupWaku = async () => {
      console.log("Creating waku node...");

      const node = await createLightNode(NODE_CONFIG);

      console.log("WAKU: Waku node created.");

      setMessagesState((prevState) => ({
        ...prevState,
        events: [
          ...prevState.events,
          { type: "log", data: "Waku node created", timestamp: Date.now() },
        ],
      }));

      setWakuNode(node);

      node.store.protocol.addLibp2pEventListener(
        "peer:connect",
        async (event) => {
          const peerId = event.detail;
          console.log(`WAKU: Peer connected with peer id: ${peerId}`);
          setMessagesState((prevState) => ({
            ...prevState,
            events: [
              ...prevState.events,
              {
                type: "peerConnected",
                data: peerId,
                timestamp: Date.now(),
              },
            ],
          }));

          setMessagesState((prevState) => ({
            ...prevState,
            connectedPeers: [...prevState.connectedPeers, peerId.toString()],
          }));
        }
      );

      console.log("WAKU: Starting Waku node...");
      await node.start();

      console.log("WAKU: Waiting for a peer");
      await waitForRemotePeer(node, [
        Protocols.LightPush,
        Protocols.Filter,
        Protocols.Store,
      ]);

      console.log("WAKU: Peer found!");

      const decoder = createDecoder(ContentTopic, PubsubTopic);

      await node.filter.subscribe([decoder], (wakuMessage) => {
        if (!wakuMessage.payload) return;
        const messageObj = JSON.parse(bytesToUtf8(wakuMessage.payload));

        console.log("WAKU: Received Message - ", messageObj);
        setMessagesState((prevState) => ({
          ...prevState,
          messages: [
            ...prevState.messages,
            {
              type: "message",
              data: messageObj,
              peerId: messageObj.sender,
              timestamp: messageObj.timestamp,
            },
          ],
        }));
      });

      console.log("WAKU: Subscribed to messages");

      // Retrieve existing messages from the store
      const existingMessages: Message[] = await new Promise((resolve) => {
        const messages: Message[] = [];
        const callback = (wakuMessage: DecodedMessage) => {
          if (!wakuMessage.payload) return;
          const messageObj = JSON.parse(bytesToUtf8(wakuMessage.payload));
          messages.push({
            type: "message",
            data: messageObj,
            peerId: messageObj.sender,
            timestamp: messageObj.timestamp,
          });
        };

        node.store.queryWithOrderedCallback([decoder], callback).then(() => {
          console.log("WAKU: Finished querying messages");
          resolve(messages.sort((a, b) => a.timestamp - b.timestamp));
        });
      });

      // Update the messages state with existing messages
      setMessagesState((prevState) => ({
        ...prevState,
        messages: [...prevState.messages, ...existingMessages],
      }));

      console.log("WAKU: Retrieved existing messages");
    };

    if (!mutex.current) {
      mutex.current = true;
      console.log("Setting up waku...");
      setupWaku();
    }
  }, []);

  const sendMessage = (message: string) => {
    if (wakuNode) {
      const encoder = createEncoder({
        contentTopic: ContentTopic,
        pubsubTopic: PubsubTopic,
      });

      console.log("Sending waku message ", message);
      wakuNode.lightPush.send(encoder, {
        payload: utf8ToBytes(
          JSON.stringify({
            timestamp: Date.now(),
            sender: wakuIdentifier,
            message,
          })
        ),
      });
    }
  };

  return {
    send: sendMessage,
    messages: messagesState.messages,
    events: messagesState.events,
    connectedPeers: messagesState.connectedPeers,
  };
}

export default useWaku;
