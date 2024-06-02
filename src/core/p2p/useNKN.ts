import { useState, useEffect, useRef } from "react";
import { Client, MultiClient, Wallet } from "nkn-sdk-temp-patch";

const nknTopic = "zensu3";
const POLLING_INTERVAL = 2000; // 2 seconds

type Message = {
  type: "message";
  data: any;
  peerId: string;
  timestamp: number;
};

type Event = {
  type: "connected" | "connectFailed" | "log";
  data: any;
  timestamp: number;
};

type MessagesState = {
  messages: Message[];
  events: Event[];
  subscribers: string[];
};

function useNkn(nknId: string) {
  const [nknClient, setNknClient] = useState<MultiClient | undefined>();
  const mutex = useRef(false);
  const [messagesState, setMessagesState] = useState<MessagesState>({
    messages: [],
    events: [],
    subscribers: [],
  });

  useEffect(() => {
    const setupNkn = async () => {
      const wallet = new Wallet({ password: "password" });
      const client = new MultiClient({
        identifier: nknId,
        seed: wallet.getSeed(),
      });

      console.log(`NKN: NKN client created with id ${nknId}`);

      setMessagesState((prevState) => ({
        ...prevState,
        events: [
          ...prevState.events,
          { type: "log", data: "NKN client created", timestamp: Date.now() },
        ],
      }));

      setNknClient(client);

      client.onMessage(({ src, payload }) => {
        console.log(`NKN: Received message from `, src, "payload", payload);
        setMessagesState((prevState) => ({
          ...prevState,
          messages: [
            {
              type: "message",
              data: {
                timestamp: Date.now(),
                sender: src.split(".")[0],
                message: payload,
              },
              peerId: src,
              timestamp: Date.now(),
            },
            ...prevState.messages,
          ],
        }));
      });

      await client.onConnect(({ addr }) => {
        console.log(`NKN: Connected to ${addr}`);
        setMessagesState((prevState) => ({
          ...prevState,
          events: [
            ...prevState.events,
            { type: "connected", data: addr, timestamp: Date.now() },
          ],
        }));
      });

      await client.onConnectFailed(() => {
        console.log("NKN: Connection failed");
        setMessagesState((prevState) => ({
          ...prevState,
          events: [
            ...prevState.events,
            { type: "connectFailed", data: null, timestamp: Date.now() },
          ],
        }));
      });

      await wallet.subscribe(nknTopic, 1000, nknId, "");

      // Start polling for subscribers
      const intervalId = setInterval(async () => {
        const subs = await client.getSubscribers(nknTopic);
        setMessagesState((prevState) => ({
          ...prevState,
          subscribers: subs.subscribers as string[],
        }));
      }, POLLING_INTERVAL);

      // Cleanup function to clear the interval when the component unmounts
      return () => {
        clearInterval(intervalId);
      };
    };

    if (!mutex.current) {
      mutex.current = true;
      console.log("Setting up NKN...");
      setupNkn();
    }
  }, [nknId]);

  const sendMessage = (message: string) => {
    if (nknClient) {
      console.log("NKN: Sending message", message);
      nknClient.publish(nknTopic, message, { txPool: true });
    }
  };

  return {
    send: sendMessage,
    messages: messagesState.messages,
    events: messagesState.events,
    subscribers: messagesState.subscribers,
  };
}

export default useNkn;
