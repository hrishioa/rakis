"use client";
import { useEffect, useRef, useState } from "react";
import useNostr from "../../core/p2p/useNostr";
import useWaku from "../../core/p2p/useWaku";
import useNKN from "../../core/p2p/useNKN";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Label } from "../../components/ui/label";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "../../components/ui/avatar";

const P2PContainer: React.FC = () => {
  const [nodeName, setNodeName] = useState<string>("");
  const nodeNameLoading = useRef(false);

  useEffect(() => {
    if (!nodeName && !nodeNameLoading.current) {
      nodeNameLoading.current = true;
      (async () => {
        const response = await fetch("https://randomuser.me/api/");
        const data = await response.json();

        if (data.results.length > 0) {
          setNodeName(
            `${data.results[0].name.title} ${data.results[0].name.first} ${data.results[0].name.last}`
          );
        }
      })();
    }
  }, [nodeName]);

  return (nodeName && <P2PComponent nodeName={nodeName} />) || null;
};

const P2PComponent: React.FC<{ nodeName: string }> = ({ nodeName }) => {
  const {
    send: sendNostrMessage,
    messages: nostrMessages,
    events: nostrEvents,
    peers: nostrPeers,
  } = useNostr(nodeName);
  const {
    send: sendWakuMessage,
    messages: wakuMessages,
    events: wakuEvents,
    connectedPeers: wakuPeers,
  } = useWaku(nodeName);
  const {
    send: sendNKNMessage,
    messages: nknMessages,
    events: nknEvents,
    subscribers: nknSubscribers,
  } = useNKN(nodeName);
  const [message, setMessage] = useState("");
  const showTimestamps = true;

  const handleSendMessage = () => {
    if (message.trim() !== "") {
      sendNostrMessage(message);
      sendWakuMessage(message);
      sendNKNMessage(message);
      setMessage("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSendMessage();
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-xl font-bold mb-4">P2P Test - {nodeName}</h1>
      <div className="grid grid-cols-3 gap-4">
        {/* Nostr */}
        <div>
          <h2 className="text-lg font-bold mb-2">Nostr</h2>
          <div className="grid grid-cols-2 gap-2">
            <Card>
              <CardHeader>
                <CardTitle>Messages</CardTitle>
              </CardHeader>
              <CardContent className="h-48 overflow-y-auto">
                <ul className="text-xs">
                  {nostrMessages.map((message, index) => (
                    <li
                      key={index}
                      className="mb-1 flex items-center space-x-1"
                    >
                      <Avatar className="w-4 h-4">
                        <AvatarImage
                          src={`https://api.dicebear.com/5.x/initials/svg?seed=${message.data.nickName}`}
                          alt={message.data.nickName}
                        />
                        <AvatarFallback>
                          {message.data.nickName.slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div
                          className={`font-semibold ${
                            message.data.nickName === nodeName
                              ? "text-blue-500"
                              : ""
                          }`}
                        >
                          {message.data.nickName}: {message.data.message}
                        </div>
                        {showTimestamps && (
                          <div className="text-xs text-gray-500">
                            {new Date(message.timestamp).toLocaleString()}
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Events</CardTitle>
              </CardHeader>
              <CardContent className="h-48 overflow-y-auto">
                <ul className="text-xs">
                  {nostrEvents.map((event, index) => (
                    <li key={index} className="mb-1">
                      <div className="font-semibold">{event.type}</div>
                      <div>{event.data}</div>
                      {showTimestamps && (
                        <div className="text-xs text-gray-500">
                          {new Date(event.timestamp).toLocaleString()}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
            <Card className="col-span-2">
              <CardHeader>
                <CardTitle>Connected Peers</CardTitle>
              </CardHeader>
              <CardContent className="h-24 overflow-y-auto">
                <ul className="text-xs">
                  {nostrPeers.map((peer, index) => (
                    <li
                      key={index}
                      className="mb-1 flex items-center space-x-1"
                    >
                      <Avatar className="w-4 h-4">
                        <AvatarImage
                          src={`https://api.dicebear.com/5.x/initials/svg?seed=${peer}`}
                          alt={peer}
                        />
                        <AvatarFallback>{peer.slice(0, 2)}</AvatarFallback>
                      </Avatar>
                      <div>{peer}</div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Waku */}
        <div>
          <h2 className="text-lg font-bold mb-2">Waku</h2>
          <div className="grid grid-cols-2 gap-2">
            <Card>
              <CardHeader>
                <CardTitle>Messages</CardTitle>
              </CardHeader>
              <CardContent className="h-48 overflow-y-auto">
                <ul className="text-xs">
                  {wakuMessages.map((message, index) => (
                    <li
                      key={index}
                      className="mb-1 flex items-center space-x-1"
                    >
                      <Avatar className="w-4 h-4">
                        <AvatarImage
                          src={`https://api.dicebear.com/5.x/initials/svg?seed=${message.data.sender}`}
                          alt={message.data.sender}
                        />
                        <AvatarFallback>
                          {message.data.sender.slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div
                          className={`font-semibold ${
                            message.data.sender === nodeName
                              ? "text-blue-500"
                              : ""
                          }`}
                        >
                          {message.data.sender}: {message.data.message}
                        </div>
                        {showTimestamps && (
                          <div className="text-xs text-gray-500">
                            {new Date(message.timestamp).toLocaleString()}
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Events</CardTitle>
              </CardHeader>
              <CardContent className="h-48 overflow-y-auto">
                <ul className="text-xs">
                  {wakuEvents.map((event, index) => (
                    <li key={index} className="mb-1">
                      <div className="font-semibold">{event.type}</div>
                      <div>{JSON.stringify(event.data)}</div>
                      {showTimestamps && (
                        <div className="text-xs text-gray-500">
                          {new Date(event.timestamp).toLocaleString()}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
            <Card className="col-span-2">
              <CardHeader>
                <CardTitle>Connected Peers (For relay)</CardTitle>
              </CardHeader>
              <CardContent className="h-24 overflow-y-auto">
                <ul className="text-xs">
                  {wakuPeers.map((peer, index) => (
                    <li
                      key={index}
                      className="mb-1 flex items-center space-x-1"
                    >
                      <Avatar className="w-4 h-4">
                        <AvatarImage
                          src={`https://api.dicebear.com/5.x/initials/svg?seed=${peer.slice(
                            -2
                          )}`}
                          alt={peer}
                        />
                        <AvatarFallback>{peer.slice(-2)}</AvatarFallback>
                      </Avatar>
                      <div>{peer}</div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* NKN */}
        <div>
          <h2 className="text-lg font-bold mb-2">NKN</h2>
          <div className="grid grid-cols-2 gap-2">
            <Card>
              <CardHeader>
                <CardTitle>Messages</CardTitle>
              </CardHeader>
              <CardContent className="h-48 overflow-y-auto">
                <ul className="text-xs">
                  {nknMessages.map((message, index) => (
                    <li
                      key={index}
                      className="mb-1 flex items-center space-x-1"
                    >
                      <Avatar className="w-4 h-4">
                        <AvatarImage
                          src={`https://api.dicebear.com/5.x/initials/svg?seed=${message.data.sender}`}
                          alt={message.data.sender}
                        />
                        <AvatarFallback>
                          {message.data.sender.slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div
                          className={`font-semibold ${
                            message.data.sender === nodeName
                              ? "text-blue-500"
                              : ""
                          }`}
                        >
                          {message.data.sender}: {message.data.message}
                        </div>
                        {showTimestamps && (
                          <div className="text-xs text-gray-500">
                            {new Date(message.timestamp).toLocaleString()}
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Events</CardTitle>
              </CardHeader>
              <CardContent className="h-48 overflow-y-auto">
                <ul className="text-xs">
                  {nknEvents.map((event, index) => (
                    <li key={index} className="mb-1">
                      <div className="font-semibold">{event.type}</div>
                      <div>{event.data}</div>
                      {showTimestamps && (
                        <div className="text-xs text-gray-500">
                          {new Date(event.timestamp).toLocaleString()}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
            <Card className="col-span-2">
              <CardHeader>
                <CardTitle>Subscribers</CardTitle>
              </CardHeader>
              <CardContent className="h-24 overflow-y-auto">
                <ul className="text-xs">
                  {nknSubscribers.map((subscriber, index) => (
                    <li
                      key={index}
                      className="mb-1 flex items-center space-x-1"
                    >
                      <Avatar className="w-4 h-4">
                        <AvatarImage
                          src={`https://api.dicebear.com/5.x/initials/svg?seed=${subscriber.slice(
                            -2,
                            -4
                          )}`}
                          alt={subscriber}
                        />
                        <AvatarFallback>
                          {subscriber.slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <div>{subscriber}</div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
      <div className="mt-4">
        <Label htmlFor="message">Message</Label>
        <Input
          id="message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="mt-1"
          onKeyDown={handleKeyDown}
        />
        <Button onClick={handleSendMessage} className="mt-2">
          Send
        </Button>
      </div>
    </div>
  );
};

export default P2PContainer;
