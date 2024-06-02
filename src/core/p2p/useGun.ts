import { useState, useEffect, useRef } from "react";
import Gun, { IGunInstance } from "gun";

type Message = {
  type: "message";
  data: any;
  peerId: string;
  timestamp: number;
};

type Event = {
  type: "connected" | "log";
  data: any;
  timestamp: number;
};

type MessagesState = {
  messages: Message[];
  events: Event[];
};

function useGun(nodeName: string) {
  const gunStarted = useRef(false);
  const [gun, setGun] = useState<IGunInstance<any> | undefined>();
  const [latestMessage, setLatestMessage] = useState<Message | undefined>();
  const [messagesState, setMessagesState] = useState<MessagesState>({
    messages: [],
    events: [],
  });

  useEffect(() => {
    if (
      latestMessage &&
      !messagesState.messages.find(
        (message) =>
          message.timestamp === latestMessage.timestamp &&
          message.peerId === latestMessage.peerId
      )
    ) {
      const oldMessageList = messagesState.messages;

      const newMessageList = [latestMessage, ...messagesState.messages].sort(
        (a, b) => b.timestamp - a.timestamp
      );

      console.log("GUN: Old message list", oldMessageList);
      console.log("GUN: New message list", newMessageList);

      setLatestMessage(undefined);

      setMessagesState((prevState) => ({
        ...prevState,
        messages: newMessageList,
      }));
    }
  }, [messagesState, latestMessage]);

  useEffect(() => {
    const setupGun = () => {
      const gunInstance = Gun({
        peers: [
          "https://gun-manhattan.herokuapp.com/gun",
          "https://peer.wallie.io/gun",
          "https://gundb-relay-mlccl.ondigitalocean.app/gun",
          "https://plankton-app-6qfp3.ondigitalocean.app/",
        ],
      });
      setGun(gunInstance);

      console.log("GUN: Gun instance created");

      setMessagesState((prevState) => ({
        ...prevState,
        events: [
          ...prevState.events,
          { type: "log", data: "Gun instance created", timestamp: Date.now() },
        ],
      }));

      console.log("Attaching gun listener");
      gunInstance.get("messages").on((data, key) => {
        console.log("GUN: Received message", data);
        setLatestMessage({
          type: "message",
          data: JSON.parse(JSON.stringify(data)),
          peerId: data.nickName,
          timestamp: data.time,
        });
      });
    };

    if (!gun && !gunStarted.current) {
      gunStarted.current = true;
      console.log("Setting up GUN...");

      setupGun();
    }
  }, [gun]);

  const sendMessage = (message: string) => {
    if (gun) {
      console.log("GUN: Sending message", message);
      gun.get("messages").put({
        message,
        nickName: nodeName,
        time: new Date().getTime(),
      });
    }
  };

  return {
    send: sendMessage,
    messages: messagesState.messages,
    events: messagesState.events,
  };
}

export default useGun;
