import { Client, MultiClient, Wallet } from "nkn-sdk-temp-patch";

let nknClient: MultiClient | undefined;

const NKN_STYLE = "color: #ff00ff; font-weight: bold";
const nknTopic = "zensu";

export async function sendNknMessage(message: string) {
  if (!nknClient) {
    return;
  }

  console.log("%cNKN: Sending message", NKN_STYLE, message);
  await nknClient.publish(nknTopic, message, { txPool: true });
  console.log("%cNKN: Sent message", NKN_STYLE, message);
}

export async function getSubscribers() {
  if (!nknClient) {
    return;
  }

  const subs = await nknClient.getSubscribers(nknTopic);

  return subs.subscribers as string[];
}

export async function setupNkn(nknId: string) {
  console.log("%cCreating NKN client...", NKN_STYLE);
  const wallet = new Wallet({ password: "password" });
  nknClient = new MultiClient({
    identifier: nknId,
    seed: wallet.getSeed(),
  });
  console.log(`%cNKN client created with id ${nknId}`, NKN_STYLE);

  nknClient.onMessage(({ src, payload }) => {
    console.log(`%cNKN: Received message from ${src}`, NKN_STYLE, src, payload);
  });

  console.log("%cNKN: Connecting client", NKN_STYLE);

  await nknClient.onConnect(({ addr }) => {
    console.log(`%cNKN: Connected to ${addr}`, NKN_STYLE);
  });

  await nknClient.onConnectFailed(() => {
    console.log("%cNKN: Connection failed", NKN_STYLE);
  });

  console.log("%cNKN: Subscribing to topic", NKN_STYLE);

  await wallet.subscribe(nknTopic, 1000, nknId, "");

  console.log("%cNKN: Subscribed to topic", NKN_STYLE);

  const num = await nknClient.getSubscribersCount(nknTopic);
  const subs = await nknClient.getSubscribers(nknTopic);

  console.log(`%cNKN: ${num} Subscribers ${subs}`, NKN_STYLE);

  if (typeof window !== "undefined") {
    (window as any).nknClient = nknClient;
    (window as any).sendNknMessage = sendNknMessage;
  }
}
