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
      <h1 className="text-3xl font-bold mb-8 text-center text-slate-800">
        P2P Test - {nodeName}
      </h1>
      <div className="grid grid-cols-3 gap-8">
        {/* Nostr */}
        <div>
          <h2 className="text-xl font-semibold mb-4 text-purple-600">Nostr</h2>
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Connected Peers</CardTitle>
              </CardHeader>
              <CardContent className="h-32 overflow-y-auto">
                <ul className="text-sm space-y-2">
                  {nostrPeers.map((peer, index) => (
                    <li key={index} className="flex items-center space-x-2">
                      <Avatar className="w-6 h-6">
                        <AvatarImage
                          src={`https://api.dicebear.com/5.x/initials/svg?seed=${peer}`}
                          alt={peer}
                        />
                        <AvatarFallback>{peer.slice(0, 2)}</AvatarFallback>
                      </Avatar>
                      <div className="font-medium text-slate-700">{peer}</div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Events</CardTitle>
              </CardHeader>
              <CardContent className="h-32 overflow-y-auto">
                <ul className="text-sm space-y-2">
                  {nostrEvents.map((event, index) => (
                    <li key={index}>
                      <div className="font-medium text-slate-700">
                        {event.type}
                      </div>
                      <div className="text-slate-500">{event.data}</div>
                      {showTimestamps && (
                        <div className="text-xs text-slate-400">
                          {new Date(event.timestamp).toLocaleString()}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Messages</CardTitle>
              </CardHeader>
              <CardContent className="h-64 overflow-y-auto">
                <ul className="text-sm space-y-4">
                  {nostrMessages.map((message, index) => (
                    <li key={index} className="flex space-x-2">
                      <Avatar className="w-8 h-8">
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
                              ? "text-purple-600"
                              : "text-slate-700"
                          }`}
                        >
                          {message.data.nickName}
                        </div>
                        <div className="text-slate-500">
                          {message.data.message}
                        </div>
                        {showTimestamps && (
                          <div className="text-xs text-slate-400">
                            {new Date(message.timestamp).toLocaleString()}
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Waku */}
        <div>
          <h2 className="text-xl font-semibold mb-4 text-emerald-600">Waku</h2>
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Connected Peers (For relay)</CardTitle>
              </CardHeader>
              <CardContent className="h-32 overflow-y-auto">
                <ul className="text-sm space-y-2">
                  {wakuPeers.map((peer, index) => (
                    <li key={index} className="flex items-center space-x-2">
                      <Avatar className="w-6 h-6">
                        <AvatarImage
                          src={`https://api.dicebear.com/5.x/initials/svg?seed=${peer.slice(
                            -2
                          )}`}
                          alt={peer}
                        />
                        <AvatarFallback>{peer.slice(-2)}</AvatarFallback>
                      </Avatar>
                      <div className="font-medium text-slate-700">{peer}</div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Events</CardTitle>
              </CardHeader>
              <CardContent className="h-32 overflow-y-auto">
                <ul className="text-sm space-y-2">
                  {wakuEvents.map((event, index) => (
                    <li key={index}>
                      <div className="font-medium text-slate-700">
                        {event.type}
                      </div>
                      <div className="text-slate-500">
                        {JSON.stringify(event.data)}
                      </div>
                      {showTimestamps && (
                        <div className="text-xs text-slate-400">
                          {new Date(event.timestamp).toLocaleString()}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Messages</CardTitle>
              </CardHeader>
              <CardContent className="h-64 overflow-y-auto">
                <ul className="text-sm space-y-4">
                  {wakuMessages.map((message, index) => (
                    <li key={index} className="flex space-x-2">
                      <Avatar className="w-8 h-8">
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
                              ? "text-emerald-600"
                              : "text-slate-700"
                          }`}
                        >
                          {message.data.sender}
                        </div>
                        <div className="text-slate-500">
                          {message.data.message}
                        </div>
                        {showTimestamps && (
                          <div className="text-xs text-slate-400">
                            {new Date(message.timestamp).toLocaleString()}
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* NKN */}
        <div>
          <h2 className="text-xl font-semibold mb-4 text-sky-600">NKN</h2>
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Subscribers</CardTitle>
              </CardHeader>
              <CardContent className="h-32 overflow-y-auto">
                <ul className="text-sm space-y-2">
                  {nknSubscribers.map((subscriber, index) => (
                    <li key={index} className="flex items-center space-x-2">
                      <Avatar className="w-6 h-6">
                        <AvatarImage
                          src={`https://api.dicebear.com/5.x/initials/svg?seed=${subscriber.slice(
                            -4,
                            -2
                          )}`}
                          alt={subscriber}
                        />
                        <AvatarFallback>
                          {subscriber.slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="font-medium text-slate-700">
                        {subscriber}
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
              <CardContent className="h-32 overflow-y-auto">
                <ul className="text-sm space-y-2">
                  {nknEvents.map((event, index) => (
                    <li key={index}>
                      <div className="font-medium text-slate-700">
                        {event.type}
                      </div>
                      <div className="text-slate-500">{event.data}</div>
                      {showTimestamps && (
                        <div className="text-xs text-slate-400">
                          {new Date(event.timestamp).toLocaleString()}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Messages</CardTitle>
              </CardHeader>
              <CardContent className="h-64 overflow-y-auto">
                <ul className="text-sm space-y-4">
                  {nknMessages.map((message, index) => (
                    <li key={index} className="flex space-x-2">
                      <Avatar className="w-8 h-8">
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
                              ? "text-sky-600"
                              : "text-slate-700"
                          }`}
                        >
                          {message.data.sender}
                        </div>
                        <div className="text-slate-500">
                          {message.data.message}
                        </div>
                        {showTimestamps && (
                          <div className="text-xs text-slate-400">
                            {new Date(message.timestamp).toLocaleString()}
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
      <div className="mt-8">
        <Label
          htmlFor="message"
          className="block mb-1 font-medium text-slate-700"
        >
          Message
        </Label>
        <Input
          id="message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm shadow-sm placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          placeholder="Type your message..."
        />
        <Button
          onClick={handleSendMessage}
          className="mt-4 w-full bg-indigo-600 text-white font-semibold py-2 px-4 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          Send
        </Button>
      </div>
    </div>
  );
};

export default P2PContainer;
