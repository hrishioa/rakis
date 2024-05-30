import { Client, MultiClient, Wallet } from "nkn-sdk";

export async function testNknPubSub() {
  // client 1
  const wallet1 = new Wallet({ password: "password1" });
  const client1 = new MultiClient({
    identifier: "my-identifier",
    seed: wallet1.getSeed(),
  });
  client1.onMessage(({ src, payload }) => {
    console.log("got data on client 1", { src, payload });
  });

  // client 2
  const wallet2 = new Wallet({ password: "password2" });
  const client2 = new MultiClient({
    identifier: "my-identifier",
    seed: wallet2.getSeed(),
  });
  client2.onMessage(({ src, payload }) => {
    console.log("got data on client 2", { src, payload });
  });

  await Promise.all([
    new Promise<void>((resolve) => client1.onConnect(resolve as any)),
    new Promise<void>((resolve) => client2.onConnect(resolve as any)),
  ]);
  await Promise.all([
    new Promise<void>((resolve) =>
      wallet1
        .subscribe("some-topic", 100, "my-identifier", "")
        .then(resolve as any)
    ),
    new Promise<void>((resolve) =>
      wallet2
        .subscribe("some-topic", 100, "my-identifier", "")
        .then(resolve as any)
    ),
  ]);

  const num = await client1.getSubscribersCount("some-topic");
  const subs = await client1.getSubscribers("some-topic");
  console.log({ num, subs });

  // publish
  console.log("Publishing");
  client1.publish("some-topic", "hello world", { txPool: true });
  console.log("Published");

  return new Promise((resolve, reject) => {
    console.log("Indefinitely waiting...");
  });
}
