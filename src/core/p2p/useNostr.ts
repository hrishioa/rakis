import { useState, useEffect, useRef } from "react";
import { joinRoom, Room } from "trystero/torrent";

const trysteroAppId = "zensu";
const trysteroTopic = "zensu-chat";

type Message = {
  type: "message";
  data: any;
  peerId: string;
  timestamp: number;
};

type Event = {
  type: "online" | "peerJoined" | "peerLeft" | "log";
  data: any;
  timestamp: number;
};

type MessagesState = {
  messages: Message[];
  events: Event[];
  peers: string[];
};

function useNostr(trysteroId: string) {
  const [trysteroRoom, setTrysteroRoom] = useState<Room | undefined>();
  const mutex = useRef(false);
  const [messagesState, setMessagesState] = useState<MessagesState>({
    messages: [],
    events: [],
    peers: [],
  });

  useEffect(() => {
    const setupNostr = async () => {
      const room = await joinRoom(
        {
          appId: trysteroAppId,
        },
        trysteroTopic
      );

      console.log("Nostr: Nostr client created", room);

      setMessagesState((prevState) => ({
        ...prevState,
        events: [
          ...prevState.events,
          { type: "log", data: "Nostr client created", timestamp: Date.now() },
        ],
      }));

      setTrysteroRoom(room);

      room.onPeerJoin((peerId) => {
        console.log("Nostr: Peer joined", peerId);
        setMessagesState((prevState) => ({
          ...prevState,
          events: [
            ...prevState.events,
            { type: "peerJoined", data: peerId, timestamp: Date.now() },
          ],
          peers: [...prevState.peers, peerId],
        }));
      });

      room.onPeerLeave((peerId) => {
        setMessagesState((prevState) => ({
          ...prevState,
          events: [
            ...prevState.events,
            { type: "peerLeft", data: peerId, timestamp: Date.now() },
          ],
          peers: prevState.peers.filter((peer) => peer !== peerId),
        }));
      });

      const [, getMessages] = room.makeAction(trysteroTopic);

      getMessages((data, peerId) => {
        setMessagesState((prevState) => ({
          ...prevState,
          messages: [
            ...prevState.messages,
            { type: "message", data, peerId, timestamp: Date.now() },
          ],
        }));
      });
    };

    if (!mutex.current) {
      mutex.current = true;
      console.log("Setting up nostr...");
      setupNostr();
    }
  }, []);

  const sendMessage = (message: string) => {
    if (trysteroRoom) {
      const [sendMessage] = trysteroRoom.makeAction(trysteroTopic);
      sendMessage({
        nickName: trysteroId,
        message,
      });
      setMessagesState((prevState) => ({
        ...prevState,
        messages: [
          ...prevState.messages,
          {
            type: "message",
            data: { nickName: trysteroId, message },
            peerId: trysteroId,
            timestamp: Date.now(),
          },
        ],
      }));
    }
  };

  return {
    send: sendMessage,
    messages: messagesState.messages,
    events: messagesState.events,
    peers: messagesState.peers,
  };
}

export default useNostr;
