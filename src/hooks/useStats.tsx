import { useEffect, useRef, useState } from "react";
import { TheDomain } from "../rakis-core/synthient-chain/thedomain/thedomain";
import { RakisStats } from "../rakis-core/synthient-chain/db/entities";

export default function useStats(sinceDays: number) {
  const [domainInstance, setDomainInstance] = useState<TheDomain | null>(null);
  const domainPickupTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [stats, setStats] = useState<RakisStats | null>(null);
  const statsPickupTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
      if (!statsPickupTimeoutRef.current) {
        statsPickupTimeoutRef.current = setInterval(async () => {
          const oneWeekAgo = new Date();
          oneWeekAgo.setDate(oneWeekAgo.getDate() - sinceDays);

          const stats = await domainInstance.getStats(oneWeekAgo);
          setStats(stats);
        }, 3000);
      }
    }
  });

  return stats;
}
