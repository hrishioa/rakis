import { useEffect, useRef, useState } from "react";
import { TheDomain } from "../rakis-core/synthient-chain/thedomain/thedomain";
import { ReceivedPeerPacket } from "../rakis-core/synthient-chain/db/packet-types";
import { debounce } from "lodash";

export default function usePackets({ packetLimit }: { packetLimit: number }) {
  const [domainInstance, setDomainInstance] = useState<TheDomain | null>(null);
  const domainPickupTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [packets, setPackets] = useState<{
    packets: ReceivedPeerPacket[];
    total: number;
  } | null>(null);
  const packetPickupTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const refreshPackets = debounce(async () => {
    if (domainInstance) {
      const packets = await domainInstance.packetDB.getLastPackets(packetLimit);

      setPackets(packets);
    }
  }, 10);

  useEffect(() => {
    if (!domainInstance && !domainPickupTimeoutRef.current) {
      domainPickupTimeoutRef.current = setInterval(() => {
        const dInstance = TheDomain.getInstance();
        if (dInstance) {
          clearInterval(domainPickupTimeoutRef.current!);
          domainPickupTimeoutRef.current = null;
          setDomainInstance(dInstance);
        }
      }, 1000);
    } else if (domainInstance) {
      if (!packetPickupTimeoutRef.current) {
        packetPickupTimeoutRef.current = setInterval(() => {
          refreshPackets();
        }, 1000);
        refreshPackets();
      }
    }

    return () => {
      if (domainPickupTimeoutRef.current) {
        clearInterval(domainPickupTimeoutRef.current);
        domainPickupTimeoutRef.current = null;
      }

      if (packetPickupTimeoutRef.current) {
        clearInterval(packetPickupTimeoutRef.current);
        packetPickupTimeoutRef.current = null;
      }
    };
  }, [domainInstance, packetLimit, refreshPackets]);

  return packets;
}
