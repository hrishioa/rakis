import { useState, useEffect, useRef } from "react";
import { joinRoom as joinTorrentRoom } from "trystero/torrent";
import { joinRoom as joinNostrRoom } from "trystero/nostr";

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

const relayRedundancy = 4;

const rtcConfig = {
  iceServers: [
    {
      urls: "stun:stun.relay.metered.ca:80",
    },
    {
      urls: "turn:a.relay.metered.ca:80",
      username: "fd396a3275680a085c4d66cd",
      credential: "hFQmauZyx0Mv0bCK",
    },
    {
      urls: "turn:a.relay.metered.ca:80?transport=tcp",
      username: "fd396a3275680a085c4d66cd",
      credential: "hFQmauZyx0Mv0bCK",
    },
    {
      urls: "turn:a.relay.metered.ca:443",
      username: "fd396a3275680a085c4d66cd",
      credential: "hFQmauZyx0Mv0bCK",
    },
    {
      urls: "turn:a.relay.metered.ca:443?transport=tcp",
      username: "fd396a3275680a085c4d66cd",
      credential: "hFQmauZyx0Mv0bCK",
    },
  ],
};

function useTrystero(trysteroId: string, trysteroType: "torrent" | "nostr") {
  const [trysteroRoom, setTrysteroRoom] = useState<any>();
  const mutex = useRef(false);
  const [messagesState, setMessagesState] = useState<MessagesState>({
    messages: [],
    events: [],
    peers: [],
  });

  useEffect(() => {
    const setupTrystero = async () => {
      const room =
        trysteroType === "nostr"
          ? await joinNostrRoom(
              {
                appId: trysteroAppId,
                relayRedundancy,
                rtcConfig,
              },
              trysteroTopic
            )
          : await joinTorrentRoom(
              {
                appId: trysteroAppId,
                relayRedundancy,
                rtcConfig,
              },
              trysteroTopic
            );

      console.log("Trystero: Trystero client created", room);

      setMessagesState((prevState) => ({
        ...prevState,
        events: [
          ...prevState.events,
          {
            type: "log",
            data: `${trysteroType} client created`,
            timestamp: Date.now(),
          },
        ],
      }));

      setTrysteroRoom(room);

      room.onPeerJoin((peerId) => {
        console.log("Trystero: Peer joined", peerId);
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
      console.log("Setting up Trystero...");
      setupTrystero();
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
          {
            type: "message",
            data: { nickName: trysteroId, message },
            peerId: trysteroId,
            timestamp: Date.now(),
          },
          ...prevState.messages,
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

export default useTrystero;
