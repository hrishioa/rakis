// Custom logger function

import EventEmitter from "eventemitter3";
import { LOGGER_SETTINGS } from "../thedomain/settings";
import { debounce } from "lodash";

export const logStyles = {
  llmEngine: {
    main: "background: #f0f8ff; color: #1e90ff; font-weight: bold;",
    worker: "background: #f0f8ff; color: #87cefa;",
  },
  embeddingEngine: {
    main: "background: #f0fff0; color: #2e8b57; font-weight: bold;",
    worker: "background: #f0fff0; color: #90ee90;",
  },
  theDomain: "background: #fff0f5; color: #ff69b4; font-weight: bold;",
  consensusCore: "background: #f5f5f5; color: #4682b4; font-weight: bold;",
  databases: {
    inferenceDB: "background: #f5f5f5; color: #a9a9a9;",
    packetDB: "background: #f5f5f5; color: #708090;",
    peerDB: "background: #f5f5f5; color: #778899;",
    quorumDB: "background: #f5f5f5; color: #696969;",
  },
  p2pNetworks: {
    nkn: "background: #fffacd; color: #ffa500;",
    torrent: "background: #fffacd; color: #ff8c00;",
    pewpewdb: "background: #fffacd; color: #ff7f50;",
    nostr: "background: #fffacd; color: #ff6347;",
  },
};

export type LogType = "trace" | "debug" | "info" | "warn" | "error";

export type SynthientLogger = {
  trace: (firstArg: string, ...args: any[]) => void;
  debug: (firstArg: string, ...args: any[]) => void;
  info: (firstArg: string, ...args: any[]) => void;
  warn: (firstArg: string, ...args: any[]) => void;
  error: (firstArg: string, ...args: any[]) => void;
};

export type INLogsEvents = {
  newLog: () => void;
};

export type StringLog = {
  at: Date;
  logger: string;
  type: LogType;
  message: string;
};

export class InMemoryLogs extends EventEmitter {
  private static instance: InMemoryLogs;
  public logs: StringLog[] = [];

  private constructor() {
    super();
  }

  static getInstance() {
    if (!InMemoryLogs.instance) {
      InMemoryLogs.instance = new InMemoryLogs();
    }
    return InMemoryLogs.instance;
  }

  private emitNewLogs = debounce(() => {
    this.emit("newLog");
  }, LOGGER_SETTINGS.newLogEventDebounceMs);

  static addLog(logger: string, type: LogType, message: string) {
    InMemoryLogs.getInstance().logs.push({
      at: new Date(),
      logger,
      type,
      message,
    });
    InMemoryLogs.getInstance().logs = InMemoryLogs.getInstance()
      .logs.slice(-LOGGER_SETTINGS.maxLogsInMemory)
      .sort((a, b) => b.at.getTime() - a.at.getTime());

    InMemoryLogs.getInstance().emitNewLogs();
  }
}

export function createLogger(
  name: string,
  style: string,
  noWindow: boolean = false
): SynthientLogger {
  if (!noWindow && typeof window !== "undefined" && window) {
    (window as any).blockedLogLevels =
      localStorage.getItem("blockedLogLevels") || [];
    (window as any).blockedLoggers =
      localStorage.getItem("blockedLoggers") || [];
  }

  const logger = {
    trace: (firstArg: string, ...args: any[]) => {
      if (
        !noWindow &&
        ((window as any)?.blockedLogLevels?.includes("trace") ||
          (window as any)?.blockedLoggers?.includes(name))
      )
        return;
      console.log(`%c[T] ${name}:`, style, firstArg, ...args);
    },
    debug: (firstArg: string, ...args: any[]) => {
      if (
        !noWindow &&
        ((window as any)?.blockedLogLevels?.includes("debug") ||
          (window as any)?.blockedLoggers?.includes(name))
      )
        return;
      if (!LOGGER_SETTINGS.loggersToSkipForInMemoryLog.includes(name))
        InMemoryLogs.addLog(name, "debug", firstArg);
      console.log(`%c[D] ${name}:`, style, firstArg, ...args);
    },
    info: (firstArg: string, ...args: any[]) => {
      if (
        !noWindow &&
        ((window as any)?.blockedLogLevels?.includes("info") ||
          (window as any)?.blockedLoggers?.includes(name))
      )
        return;

      if (!LOGGER_SETTINGS.loggersToSkipForInMemoryLog.includes(name))
        InMemoryLogs.addLog(name, "info", firstArg);
      console.log(`%c[I] ${name}:`, style, firstArg, ...args);
    },
    warn: (firstArg: string, ...args: any[]) => {
      if (
        !noWindow &&
        ((window as any)?.blockedLogLevels?.includes("warn") ||
          (window as any)?.blockedLoggers?.includes(name))
      )
        return;

      if (!LOGGER_SETTINGS.loggersToSkipForInMemoryLog.includes(name))
        InMemoryLogs.addLog(name, "warn", firstArg);
      console.warn(`%c[W] ${name}:`, style, firstArg, ...args);
    },
    error: (firstArg: string, ...args: any[]) => {
      if (
        !noWindow &&
        ((window as any)?.blockedLogLevels?.includes("error") ||
          (window as any)?.blockedLoggers?.includes(name))
      )
        return;

      if (!LOGGER_SETTINGS.loggersToSkipForInMemoryLog.includes(name))
        InMemoryLogs.addLog(name, "error", firstArg);
      console.error(`%c[ERROR] ${name}:`, style, firstArg, ...args);
    },
  };

  return logger;
}
