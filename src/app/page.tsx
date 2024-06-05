"use client";

import { useEffect, useRef } from "react";
import { initClientInfo } from "../core/synthient-chain/identity";
import { startTheDomain } from "../core/synthient-chain/thedomain/bootup";
export default function Home() {
  const domainMutex = useRef(false);

  useEffect(() => {
    if (domainMutex.current) return;
    domainMutex.current = true;
    startTheDomain({
      identityPassword: "test-password",
      overwriteIdentity: true,
    });

    // initClientInfo("test-password", true).then((clientInfo) => {
    //   console.log("Got client info ", clientInfo);
    // });
  });

  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      Welcome to Synthient!
    </main>
  );
}
