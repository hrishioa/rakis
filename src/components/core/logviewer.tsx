"use client";

import { useEffect, useState } from "react";
import {
  InMemoryLogs,
  StringLog,
} from "../../rakis-core/synthient-chain/utils/logger";

const LogViewer: React.FC = () => {
  const [logEntries, setLogEntries] = useState<StringLog[]>([]);

  useEffect(() => {
    setLogEntries(InMemoryLogs.getInstance().logs);

    const onNewLog = () => {
      setLogEntries(InMemoryLogs.getInstance().logs);
    };

    InMemoryLogs.getInstance().on("newLog", onNewLog);

    return () => {
      InMemoryLogs.getInstance().off("newLog", onNewLog);
    };
  }, []);

  return (
    <div className="flex flex-col overflow-auto h-[calc(50vh-4rem)]">
      {logEntries.map((log, index) => (
        <div
          key={index}
          className={`p-2 border-b border-gray-200 ${
            log.type === "error" ? "bg-red-50" : ""
          }`}
        >
          <div className="text-sm text-gray-500">{log.at.toLocaleString()}</div>
          <div className="text-sm font-bold">{log.logger}</div>
          <div className="text-sm">{log.message}</div>
        </div>
      ))}
    </div>
  );
};

export default LogViewer;
