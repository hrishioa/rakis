"use client";

import { useState, useEffect, useRef } from "react";
import {
  ClientInfo,
  initClientInfo,
} from "../../../core/synthient-chain/identity";
import { GunP2PNetworkInstance } from "../../../core/synthient-chain/p2p-networks/pewpewdb";
import { PacketDB } from "../../../core/synthient-chain/db/packetdb";
import {
  PeerPacket,
  TransmittedPeerPacket,
} from "../../../core/synthient-chain/db/packet-types";
import { Card } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { stringifyDateWithOffset } from "../../../core/synthient-chain/utils/utils";
import { NknP2PNetworkInstance } from "../../../core/synthient-chain/p2p-networks/nkn";
import { TrysteroP2PNetworkInstance } from "../../../core/synthient-chain/p2p-networks/trystero";
import { P2P_CONFIG } from "../../../core/synthient-chain/p2p-networks/p2p-config";

const Heart = ({ x, y, source }: { x: number; y: number; source: string }) => {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
    }, 1000); // Adjust the duration as needed

    return () => {
      clearTimeout(timer);
    };
  }, []);

  if (!visible) {
    return null;
  }

  return (
    <span className="absolute animate-pulse" style={{ left: x, top: y }}>
      <span className="text-4xl">❤️</span>
      <br />
      <span className="absolute text-sm">{source}</span>
    </span>
  );
};

const Home = () => {
  const [password, setPassword] = useState("");
  const [clientInfo, setClientInfo] = useState<ClientInfo | null>(null);
  const [gunInstance, setGunInstance] = useState<GunP2PNetworkInstance | null>(
    null
  );
  const [nknInstance, setNKNInstance] = useState<NknP2PNetworkInstance | null>(
    null
  );
  const [nostrInstance, setNostrInstance] =
    useState<TrysteroP2PNetworkInstance | null>(null);
  const [packetDB, setPacketDB] = useState<PacketDB | null>(null);
  const [hearts, setHearts] = useState<
    { x: number; y: number; source: string; id: string }[]
  >([]);

  const initInstancesMutex = useRef(false);

  useEffect(() => {
    const initInstances = async () => {
      if (!initInstancesMutex.current && clientInfo) {
        initInstancesMutex.current = true;
        console.log("Initializing GunP2PNetworkInstance...");
        const gun = new GunP2PNetworkInstance(clientInfo.synthientId, {
          gunPeers: P2P_CONFIG.PEWPEW.bootstrapPeers,
          gunTopic: P2P_CONFIG.PEWPEW.topic,
          startupDelayMs: P2P_CONFIG.PEWPEW.bootFixedDelayMs,
        });
        setGunInstance(gun);
        console.log("GunP2PNetworkInstance initialized.");

        console.log("Initializing NknP2PNetworkInstance...");
        const nkn = new NknP2PNetworkInstance(clientInfo.synthientId, {
          nknTopic: P2P_CONFIG.NKN.topic,
          nknWalletPassword: "password",
        });
        setNKNInstance(nkn);

        console.log("Initializing TrysteroP2PNetworkInstance...");
        const nostr = new TrysteroP2PNetworkInstance(clientInfo.synthientId, {
          relayRedundancy: P2P_CONFIG.TRYSTERO.relayRedundancy,
          rtcConfig: P2P_CONFIG.TRYSTERO.rtcConfig,
          trysteroTopic: P2P_CONFIG.TRYSTERO.topic,
          trysteroAppId: P2P_CONFIG.TRYSTERO.appId,
          trysteroType: "nostr",
        });
        setNostrInstance(nostr);

        await Promise.all([
          gun.waitForReady(),
          nkn.waitForReady(),
          nostr.waitForReady(),
        ]);

        console.log("Initializing PacketDB...");
        const packetdb = new PacketDB(
          clientInfo,
          async (packet: TransmittedPeerPacket) => {
            await Promise.all([
              gun.broadcastPacket(packet),
              nkn.broadcastPacket(packet),
              nostr.broadcastPacket(packet),
            ]);

            // const selectedNetwork = Math.floor(Math.random() * 3);
            // switch (selectedNetwork) {
            //   case 0:
            //     gun.broadcastPacket(packet);
            //     break;
            //   case 1:
            //     nkn.broadcastPacket(packet);
            //     break;
            //   case 2:
            //     nostr.broadcastPacket(packet);
            //     break;
            // }
          }
        );
        setPacketDB(packetdb);
        console.log("PacketDB initialized.");

        if (typeof window !== "undefined") {
          (window as any).packetDB = packetdb;
        }

        initInstancesMutex.current = false;
      }
    };
    initInstances();
  }, [clientInfo]);

  useEffect(() => {
    if (gunInstance && packetDB) {
      console.log("Listening for packets...");
      gunInstance.listenForPacket(async (packet) => {
        console.log("Received packet from Gun:", packet);
        const success = await packetDB.receivePacket(packet);
        // if (success && packet.packet.type === "peerHeart") {
        //   const heart = packet.packet;
        //   setHearts((prevHearts) => [
        //     ...prevHearts,
        //     {
        //       x: heart.windowX,
        //       y: heart.windowY,
        //       id: packet.signature,
        //       source: packet.deliveredThrough || "unknown",
        //     },
        //   ]);
        // }
      });
    }
  }, [gunInstance, packetDB]);

  useEffect(() => {
    if (nknInstance && packetDB) {
      console.log("Listening for packets...");
      nknInstance.listenForPacket(async (packet) => {
        console.log("Received packet from NKN:", packet);
        const success = await packetDB.receivePacket(packet);
        // if (success && packet.packet.type === "peerHeart") {
        //   const heart = packet.packet;
        //   setHearts((prevHearts) => [
        //     ...prevHearts,
        //     {
        //       x: heart.windowX,
        //       y: heart.windowY,
        //       id: packet.signature,
        //       source: packet.deliveredThrough || "unknown",
        //     },
        //   ]);
        // }
      });
    }
  }, [nknInstance, packetDB]);

  useEffect(() => {
    if (nostrInstance && packetDB) {
      console.log("Listening for packets...");
      nostrInstance.listenForPacket(async (packet) => {
        console.log("Received packet from Trystero:", packet);
        const success = await packetDB.receivePacket(packet);
        // if (success && packet.packet.type === "peerHeart") {
        //   const heart = packet.packet;
        //   setHearts((prevHearts) => [
        //     ...prevHearts,
        //     {
        //       x: heart.windowX,
        //       y: heart.windowY,
        //       id: packet.signature,
        //       source: packet.deliveredThrough || "unknown",
        //     },
        //   ]);
        // }
      });
    }
  }, [nostrInstance, packetDB]);

  const handlePasswordKeyPress = async (
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (e.key === "Enter") {
      console.log("Initializing identity...");
      const info = await initClientInfo(password);
      setClientInfo(info);
      console.log("Identity initialized:", info);
    }
  };

  const sendHeart = async (e: React.MouseEvent<HTMLDivElement>) => {
    if (packetDB) {
      const heart: PeerPacket = {
        type: "peerHeart",
        windowX: e.clientX,
        windowY: e.clientY,
        createdAt: stringifyDateWithOffset(new Date()),
      };
      console.log("Sending heart:", heart);
      await packetDB.transmitPacket(heart);
    }
  };

  return (
    <div onClick={sendHeart} className="relative h-screen">
      {clientInfo ? (
        <Card className="absolute top-4 left-4">
          <p>synthientId: {clientInfo.synthientId}</p>
        </Card>
      ) : (
        <Card className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
          <Input
            type="password"
            placeholder="Enter password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyPress={handlePasswordKeyPress}
          />
        </Card>
      )}
      {hearts.map((heart) => (
        <Heart key={heart.id} x={heart.x} y={heart.y} source={heart.source} />
      ))}
    </div>
  );
};

export default Home;
