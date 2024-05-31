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

// export async function testNknPubSub() {
//   // client 1
//   const wallet1 = new Wallet({ password: "password1" });
//   const client1 = new MultiClient({
//     identifier: "my-identifier",
//     seed: wallet1.getSeed(),
//   });
//   client1.onMessage(({ src, payload }) => {
//     console.log("got data on client 1", { src, payload });
//   });

//   // client 2
//   const wallet2 = new Wallet({ password: "password2" });
//   const client2 = new MultiClient({
//     identifier: "my-identifier",
//     seed: wallet2.getSeed(),
//   });
//   client2.onMessage(({ src, payload }) => {
//     console.log("got data on client 2", { src, payload });
//   });

//   await Promise.all([
//     new Promise<void>((resolve) => client1.onConnect(resolve as any)),
//     new Promise<void>((resolve) => client2.onConnect(resolve as any)),
//   ]);
//   await Promise.all([
//     new Promise<void>((resolve) =>
//       wallet1
//         .subscribe("some-topic", 100, "my-identifier", "")
//         .then(resolve as any)
//     ),
//     new Promise<void>((resolve) =>
//       wallet2
//         .subscribe("some-topic", 100, "my-identifier", "")
//         .then(resolve as any)
//     ),
//   ]);

//   const num = await client1.getSubscribersCount("some-topic");
//   const subs = await client1.getSubscribers("some-topic");
//   console.log({ num, subs });

//   // publish
//   console.log("Publishing");
//   client1.publish("some-topic", "hello world", { txPool: true });
//   console.log("Published");

//   return new Promise((resolve, reject) => {
//     console.log("Indefinitely waiting...");
//   });
// }
