// Custom logger function

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

export function createLogger(
  name: string,
  style: string,
  noWindow: boolean = false
) {
  if (!noWindow && typeof window !== "undefined" && window) {
    (window as any).blockedLogLevels =
      localStorage.getItem("blockedLogLevels") || [];
    (window as any).blockedLoggers =
      localStorage.getItem("blockedLoggers") || [];
  }

  const logger = {
    trace: (...args: any[]) => {
      if (
        !noWindow &&
        ((window as any)?.blockedLogLevels?.includes("trace") ||
          (window as any)?.blockedLoggers?.includes(name))
      )
        return;
      console.log(`%c[T] ${name}:`, style, ...args);
    },
    debug: (...args: any[]) => {
      if (
        !noWindow &&
        ((window as any)?.blockedLogLevels?.includes("debug") ||
          (window as any)?.blockedLoggers?.includes(name))
      )
        return;
      console.log(`%c[D] ${name}:`, style, ...args);
    },
    info: (...args: any[]) => {
      if (
        !noWindow &&
        ((window as any)?.blockedLogLevels?.includes("info") ||
          (window as any)?.blockedLoggers?.includes(name))
      )
        return;
      console.log(`%c[I] ${name}:`, style, ...args);
    },
    warn: (...args: any[]) => {
      if (
        !noWindow &&
        ((window as any)?.blockedLogLevels?.includes("warn") ||
          (window as any)?.blockedLoggers?.includes(name))
      )
        return;
      console.warn(`%c[W] ${name}:`, style, ...args);
    },
    error: (...args: any[]) => {
      if (
        !noWindow &&
        ((window as any)?.blockedLogLevels?.includes("error") ||
          (window as any)?.blockedLoggers?.includes(name))
      )
        return;
      console.error(`%c[ERROR] ${name}:`, style, ...args);
    },
  };

  return logger;
}
