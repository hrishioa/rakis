"use client";
import { useEffect, useRef, useState } from "react";
import useTrystero from "../../core/p2p/useTrystero";
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
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "../../components/ui/avatar";
import { Switch } from "../../components/ui/switch";
import Image from "next/image";
import useGun from "../../core/p2p/useGun";

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
  } = useTrystero(nodeName, "nostr");
  const {
    send: sendTorrentMessage,
    messages: torrentMessages,
    events: torrentEvents,
    peers: torrentPeers,
  } = useTrystero(nodeName, "torrent");
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
  const {
    send: sendGunMessage,
    messages: gunMessages,
    events: gunEvents,
  } = useGun(nodeName);

  const [message, setMessage] = useState("");
  const showTimestamps = true;

  const [darkMode, setDarkMode] = useState(false);

  const handleSendMessage = () => {
    if (message.trim() !== "") {
      sendNostrMessage(message);
      sendTorrentMessage(message);
      sendWakuMessage(message);
      sendNKNMessage(message);
      sendGunMessage(message);
      setMessage("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSendMessage();
    }
  };

  return (
    <div className={`${darkMode ? "dark" : ""}`}>
      <div className="mx-auto p-4 bg-white dark:bg-slate-900">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100">
            How good is Browser P2P SoTA? - {nodeName}
          </h1>
          <div className="flex space-x-4 items-center">
            <Input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-64 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md text-sm placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:focus:border-indigo-600 dark:focus:ring-indigo-600 dark:text-slate-200"
              placeholder="Type your message..."
            />
            <Button
              onClick={handleSendMessage}
              className="bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900 text-white font-semibold py-2 px-4 rounded-md"
            >
              Send
            </Button>
          </div>
          <Switch
            checked={darkMode}
            onCheckedChange={setDarkMode}
            className="ml-4 bg-slate-200 dark:bg-slate-700 relative inline-flex h-6 w-11 items-center rounded-full"
          >
            <span className="sr-only">Enable dark mode</span>
            <span
              className={`${
                darkMode ? "translate-x-6" : "translate-x-1"
              } inline-block h-4 w-4 transform rounded-full bg-white transition`}
            />
          </Switch>
        </div>
        <div className="grid grid-cols-5 gap-8">
          {/* Torrent */}
          <div className="bg-purple-100 dark:bg-purple-900 rounded-lg p-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-purple-600 dark:text-purple-400">
                Torrent
              </h2>
              <Image
                src={"/torrent.png"}
                alt={"Vercel"}
                width={32}
                height={32}
                className="h-6 w-6"
              />
            </div>
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Connected Peers</CardTitle>
                </CardHeader>
                <CardContent className="h-24 overflow-y-auto">
                  <ul className="text-sm space-y-2">
                    {torrentPeers.map((peer, index) => (
                      <li key={index} className="flex items-center space-x-2">
                        <Avatar className="w-6 h-6">
                          <AvatarImage
                            src={`https://api.dicebear.com/5.x/initials/svg?seed=${peer}`}
                            alt={peer}
                          />
                          <AvatarFallback>{peer.slice(0, 2)}</AvatarFallback>
                        </Avatar>
                        <div className="font-medium text-slate-700 dark:text-slate-400">
                          {peer}
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
                <CardContent className="h-24 overflow-y-auto">
                  <ul className="text-sm space-y-2">
                    {torrentEvents.map((event, index) => (
                      <li key={index}>
                        <div className="font-medium text-slate-700 dark:text-slate-400">
                          {event.type}
                        </div>
                        <div className="text-slate-500 dark:text-slate-500">
                          {event.data}
                        </div>
                        {showTimestamps && (
                          <div className="text-xs text-slate-400 dark:text-slate-600">
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
                    {torrentMessages.map((message, index) => (
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
                                ? "text-purple-600 dark:text-purple-400"
                                : "text-slate-700 dark:text-slate-400"
                            }`}
                          >
                            {message.data.nickName}
                          </div>
                          <div className="text-slate-500 dark:text-slate-500">
                            {message.data.message}
                          </div>
                          {showTimestamps && (
                            <div className="text-xs text-slate-400 dark:text-slate-600">
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
          {/* Nostr */}
          <div className="bg-red-100 dark:bg-red-900 rounded-lg p-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-red-600 dark:text-red-400">
                Nostr
              </h2>
              <Image
                src={"/nostr.png"}
                alt={"Vercel"}
                width={32}
                height={32}
                className="h-6 w-6"
              />
            </div>
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Connected Peers</CardTitle>
                </CardHeader>
                <CardContent className="h-24 overflow-y-auto">
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
                        <div className="font-medium text-slate-700 dark:text-slate-400">
                          {peer}
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
                <CardContent className="h-24 overflow-y-auto">
                  <ul className="text-sm space-y-2">
                    {nostrEvents.map((event, index) => (
                      <li key={index}>
                        <div className="font-medium text-slate-700 dark:text-slate-400">
                          {event.type}
                        </div>
                        <div className="text-slate-500 dark:text-slate-500">
                          {event.data}
                        </div>
                        {showTimestamps && (
                          <div className="text-xs text-slate-400 dark:text-slate-600">
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
                                ? "text-red-600 dark:text-red-400"
                                : "text-slate-700 dark:text-slate-400"
                            }`}
                          >
                            {message.data.nickName}
                          </div>
                          <div className="text-slate-500 dark:text-slate-500">
                            {message.data.message}
                          </div>
                          {showTimestamps && (
                            <div className="text-xs text-slate-400 dark:text-slate-600">
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
          {/* Gun */}
          <div className="bg-red-100 dark:bg-red-900 rounded-lg p-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-red-600 dark:text-red-400">
                GunDB
              </h2>
              <Image
                src={"/gundb.png"}
                alt={"Vercel"}
                width={32}
                height={32}
                className="h-6 w-6"
              />
            </div>
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Events</CardTitle>
                </CardHeader>
                <CardContent className="h-24 overflow-y-auto">
                  <ul className="text-sm space-y-2">
                    {gunEvents.map((event, index) => (
                      <li key={index}>
                        <div className="font-medium text-slate-700 dark:text-slate-400">
                          {event.type}
                        </div>
                        <div className="text-slate-500 dark:text-slate-500">
                          {event.data}
                        </div>
                        {showTimestamps && (
                          <div className="text-xs text-slate-400 dark:text-slate-600">
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
                    {gunMessages.map((message, index) => (
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
                                ? "text-red-600 dark:text-red-400"
                                : "text-slate-700 dark:text-slate-400"
                            }`}
                          >
                            {message.data.nickName}
                          </div>
                          <div className="text-slate-500 dark:text-slate-500">
                            {message.data.message}
                          </div>
                          {showTimestamps && (
                            <div className="text-xs text-slate-400 dark:text-slate-600">
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
          <div className="bg-emerald-100 dark:bg-emerald-900 rounded-lg p-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-emerald-600 dark:text-emerald-400">
                Waku
              </h2>
              <Image
                src={"/waku.svg"}
                alt={"Vercel"}
                width={32}
                height={32}
                className="h-6 w-6"
              />
            </div>
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Connected Peers (For relay)</CardTitle>
                </CardHeader>
                <CardContent className="h-24 overflow-y-auto">
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
                        <div className="font-medium text-slate-700 dark:text-slate-400">
                          {peer}
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
                <CardContent className="h-24 overflow-y-auto">
                  <ul className="text-sm space-y-2">
                    {wakuEvents.map((event, index) => (
                      <li key={index}>
                        <div className="font-medium text-slate-700 dark:text-slate-400">
                          {event.type}
                        </div>
                        <div className="text-slate-500 dark:text-slate-500">
                          {JSON.stringify(event.data)}
                        </div>
                        {showTimestamps && (
                          <div className="text-xs text-slate-400 dark:text-slate-600">
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
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-slate-700 dark:text-slate-400"
                            }`}
                          >
                            {message.data.sender}
                          </div>
                          <div className="text-slate-500 dark:text-slate-500">
                            {message.data.message}
                          </div>
                          {showTimestamps && (
                            <div className="text-xs text-slate-400 dark:text-slate-600">
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
          <div className="bg-sky-100 dark:bg-sky-900 rounded-lg p-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-sky-600 dark:text-sky-400">
                NKN
              </h2>
              <Image
                src={"/nkn.png"}
                alt={"Vercel"}
                width={32}
                height={32}
                className="h-6 w-6"
              />
            </div>
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Subscribers</CardTitle>
                </CardHeader>
                <CardContent className="h-24 overflow-y-auto">
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
                        <div className="font-medium text-slate-700 dark:text-slate-400">
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
                <CardContent className="h-24 overflow-y-auto">
                  <ul className="text-sm space-y-2">
                    {nknEvents.map((event, index) => (
                      <li key={index}>
                        <div className="font-medium text-slate-700 dark:text-slate-400">
                          {event.type}
                        </div>
                        <div className="text-slate-500 dark:text-slate-500">
                          {event.data}
                        </div>
                        {showTimestamps && (
                          <div className="text-xs text-slate-400 dark:text-slate-600">
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
                                ? "text-sky-600 dark:text-sky-400"
                                : "text-slate-700 dark:text-slate-400"
                            }`}
                          >
                            {message.data.sender}
                          </div>
                          <div className="text-slate-500 dark:text-slate-500">
                            {message.data.message}
                          </div>
                          {showTimestamps && (
                            <div className="text-xs text-slate-400 dark:text-slate-600">
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
      </div>
    </div>
  );
};

export default P2PContainer;
