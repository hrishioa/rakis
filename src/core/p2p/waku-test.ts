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

import protobuf from "protobufjs";

const BOOTSTRAP_PEERS = [
  // "/dns4/node-01.do-ams3.wakuv2.prod.status.im/tcp/8000/wss/p2p/16Uiu2HAmL5okWopX7NqZWBUKVqW8iUxCEmd5GMHLVPwCgzYzQv3e",
  // "/dns4/waku.myrandomdemos.online/tcp/8000/wss/p2p/16Uiu2HAmKfC2QUvMVyBsVjuEzdo1hVhRddZxo69YkBuXYvuZ83sc", // vpavlin's node (https://discord.com/channels/1110799176264056863/1244619345762717767/1244622388306513980)
  // "/dns4/node-01.do-ams3.wakuv2.test.status.im/tcp/8000/wss/p2p/16Uiu2HAmPLe7Mzm8TsYUubgCAW1aJoeFScxrLj8ppHFivPo97bUZ",
  // "/dns4/node-01.gc-us-central1-a.wakuv2.test.status.im/tcp/8000/wss/p2p/16Uiu2HAmJb2e28qLXxT5kZxVUUoJt72EMzNGXB47Rxx5hw3q4YjS",
  // "/dns4/node-01.ac-cn-hongkong-c.wakuv2.test.status.im/tcp/8000/wss/p2p/16Uiu2HAkvWiyFsgRhuJEb9JfjYxEkoHLgnUQmr1N5mKWnYjxYRVm",
  // "/dns4/node-01.gc-us-central1-a.wakuv2.prod.statusim.net/tcp/8000/wss/p2p/16Uiu2HAmVkKntsECaYfefR1V2yCR79CegLATuTPE6B9TxgxBiiiA",
  // "/dns4/node-01.ac-cn-hongkong-c.wakuv2.prod.status.im/tcp/8000/wss/p2p/16Uiu2HAm4v86W3bmT1BiH6oSPzcsSr24iDQpSN5Qa992BCjjwgrD", //rs/2/ but working
  // "/dns4/node-01.do-ams3.wakuv2.test.status.im/tcp/8000/wss/p2p/16Uiu2HAmPLe7Mzm8TsYUubgCAW1aJoeFScxrLj8ppHFivPo97bUZ",

  // Old ones
  // "/dns4/node-01.do-ams3.wakuv2.test.status.im/tcp/8000/wss/p2p/16Uiu2HAmPLe7Mzm8TsYUubgCAW1aJoeFScxrLj8ppHFivPo97bUZ",
  // "/dns4/node-01.gc-us-central1-a.wakuv2.test.status.im/tcp/8000/wss/p2p/16Uiu2HAmJb2e28qLXxT5kZxVUUoJt72EMzNGXB47Rxx5hw3q4YjS",
  // "/dns4/node-01.ac-cn-hongkong-c.wakuv2.test.status.im/tcp/8000/wss/p2p/16Uiu2HAkvWiyFsgRhuJEb9JfjYxEkoHLgnUQmr1N5mKWnYjxYRVm",

  "/dns4/node-01.do-ams3.wakuv2.prod.status.im/tcp/8000/wss/p2p/16Uiu2HAmL5okWopX7NqZWBUKVqW8iUxCEmd5GMHLVPwCgzYzQv3e",
  "/dns4/node-01.gc-us-central1-a.wakuv2.prod.statusim.net/tcp/8000/wss/p2p/16Uiu2HAmVkKntsECaYfefR1V2yCR79CegLATuTPE6B9TxgxBiiiA",
  "/dns4/node-01.ac-cn-hongkong-c.wakuv2.prod.status.im/tcp/8000/wss/p2p/16Uiu2HAm4v86W3bmT1BiH6oSPzcsSr24iDQpSN5Qa992BCjjwgrD",
  "/dns4/node-01.do-ams3.wakuv2.test.status.im/tcp/8000/wss/p2p/16Uiu2HAmPLe7Mzm8TsYUubgCAW1aJoeFScxrLj8ppHFivPo97bUZ",
];

// const ContentTopic = "/waku-workshop/1/talk-feedback/json";
const ContentTopic = "/zensu/2/json";
const PubsubTopic = "/waku/2/default-waku/proto";

const NODE_CONFIG = {
  contentTopics: [ContentTopic],
  pubsubTopics: [PubsubTopic],
  defaultBootstrap: false,
  bootstrapPeers: [
    "/dns4/waku.myrandomdemos.online/tcp/8000/wss/p2p/16Uiu2HAmKfC2QUvMVyBsVjuEzdo1hVhRddZxo69YkBuXYvuZ83sc",
    // "/dns4/node-01.do-ams3.wakuv2.prod.status.im/tcp/8000/wss/p2p/16Uiu2HAmL5okWopX7NqZWBUKVqW8iUxCEmd5GMHLVPwCgzYzQv3e",
    // "/dns4/node-01.gc-us-central1-a.wakuv2.prod.statusim.net/tcp/8000/wss/p2p/16Uiu2HAmVkKntsECaYfefR1V2yCR79CegLATuTPE6B9TxgxBiiiA",
    // "/dns4/node-01.ac-cn-hongkong-c.wakuv2.prod.status.im/tcp/8000/wss/p2p/16Uiu2HAm4v86W3bmT1BiH6oSPzcsSr24iDQpSN5Qa992BCjjwgrD",
    // "/dns4/node-01.do-ams3.wakuv2.test.status.im/tcp/8000/wss/p2p/16Uiu2HAmPLe7Mzm8TsYUubgCAW1aJoeFScxrLj8ppHFivPo97bUZ",
  ],
  libp2p: {
    peerDiscovery: [wakuPeerExchangeDiscovery([PubsubTopic])],
  },
};

const WAKUSTYLE = "color: green; font-size: 16px;";

// const WakuMessageProtobuf = new protobuf.Type("ChatMessage")
//   .add(new protobuf.Field("timestamp", 1, "uint64"))
//   .add(new protobuf.Field("sender", 2, "string"))
//   .add(new protobuf.Field("message", 3, "string"));

const decoder = createDecoder(ContentTopic, PubsubTopic);
const encoder = createEncoder({
  contentTopic: ContentTopic,
  pubsubTopic: PubsubTopic,
});

let wakuNode: LightNode | undefined;
let wakuId: string = Math.random().toString(36).substring(7);

export async function getAllWakuMessages() {
  return new Promise((resolve, reject) => {
    if (!wakuNode) {
      resolve([]);
      return;
    }

    const callback = (wakuMessage: DecodedMessage) => {
      if (!wakuMessage.payload) return;
      const messageObj = JSON.parse(bytesToUtf8(wakuMessage.payload));

      console.log("%cWAKU: Received Message - ", WAKUSTYLE, messageObj);
    };

    wakuNode.store.queryWithOrderedCallback([decoder], callback).then(() => {
      console.log("%cWAKU: Finished querying messages", WAKUSTYLE);
      resolve([]);
    });
  });
}

export async function getWakuPeers() {
  const allPeers = (await wakuNode?.libp2p.peerStore.all())?.map(
    (peer) => peer.id
  );
  const connectedPeers = await wakuNode?.libp2p.getPeers();
  return {
    allPeers: allPeers || [],
    connectedPeers: connectedPeers || [],
  };
}

export async function sendWakuMessage(message: string) {
  if (!wakuNode) {
    return;
  }

  await wakuNode.lightPush.send(encoder, {
    payload: utf8ToBytes(
      JSON.stringify({
        timestamp: Date.now(),
        sender: wakuId,
        message,
      })
    ),
  });
}

export async function setupWaku(wakuIdentifier: string) {
  wakuId = wakuIdentifier;

  console.log("%cCreating waku node...", WAKUSTYLE);

  wakuNode = await createLightNode(NODE_CONFIG);

  console.log("%cWAKU: Waku node created.", WAKUSTYLE);

  if (typeof window !== "undefined") {
    (window as any).wakuNode = wakuNode;
  }

  // Refreshes list of connected peers each time a new one is detected
  wakuNode.store.protocol.addLibp2pEventListener(
    "peer:connect",
    async (event) => {
      const peerId = event.detail;
      console.log(`WAKU: Peer connected with peer id: ${peerId}`);
    }
  );

  console.log("%cWAKU: Starting Waku node...", WAKUSTYLE);
  await wakuNode.start();

  console.log("%cWAKU:Waiting for a peer", WAKUSTYLE);
  // await waitForRemotePeer(wakuNode, [
  //   "lightpush",
  //   "filter",
  //   "store",
  //   "peer-exchange",
  // ]);
  await waitForRemotePeer(wakuNode, [
    Protocols.LightPush,
    Protocols.Filter,
    Protocols.Store,
  ]);

  console.log("%cWAKU: Peer found!", WAKUSTYLE);

  const callback = (wakuMessage: DecodedMessage) => {
    if (!wakuMessage.payload) return;
    const messageObj = JSON.parse(bytesToUtf8(wakuMessage.payload));

    console.log("%cWAKU: Received Message - ", WAKUSTYLE, messageObj);
  };

  const unsubscribeFromMessages = await wakuNode?.filter.subscribe(
    [decoder],
    (wakuMessage) => {
      callback(wakuMessage);
    }
  );
  console.log("%cWAKU: Subscribed to messages", WAKUSTYLE);

  // console.log("%cWAKU: Subscribed to messages", WAKUSTYLE);

  (window as any).sendWakuMessage = sendWakuMessage;
  (window as any).wakuGetPeers = getWakuPeers;
  (window as any).wakuGetMessages = getAllWakuMessages;

  console.log("%cWaku setup complete", WAKUSTYLE);
}
