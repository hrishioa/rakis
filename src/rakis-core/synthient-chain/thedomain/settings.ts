import { SupportedP2PDeliveryNetwork } from "../db/entities";
import { EmbeddingModelName } from "../embeddings/types";
import { LLMModelName } from "../llm/types";

export const STORED_SETTINGS_KEY = "rakisSettings";

export type STORED_SETTINGS = Partial<{
  packetDBSettings: Partial<typeof DEFAULT_PACKET_DB_SETTINGS>;
  p2pSettings: Partial<typeof DEFAULT_P2P_SETTINGS>;
  chainConnectionSettings: Partial<typeof DEFAULT_CHAIN_CONNECTION_SETTINGS>;
  loggerSettings: Partial<typeof DEFAULT_LOGGER_SETTINGS>;
  theDomainSettings: Partial<typeof DEFAULT_THEDOMAIN_SETTINGS>;
  quorumSettings: Partial<typeof DEFAULT_QUORUM_SETTINGS>;
  llmEngineSettings: Partial<typeof DEFAULT_LLM_ENGINE_SETTINGS>;
  workerSettings: Partial<typeof DEFAULT_WORKER_SETTINGS>;
}>;

export type LOADED_SETTINGS = {
  packetDBSettings: typeof DEFAULT_PACKET_DB_SETTINGS;
  p2pSettings: typeof DEFAULT_P2P_SETTINGS;
  chainConnectionSettings: typeof DEFAULT_CHAIN_CONNECTION_SETTINGS;
  loggerSettings: typeof DEFAULT_LOGGER_SETTINGS;
  theDomainSettings: typeof DEFAULT_THEDOMAIN_SETTINGS;
  quorumSettings: typeof DEFAULT_QUORUM_SETTINGS;
  llmEngineSettings: typeof DEFAULT_LLM_ENGINE_SETTINGS;
  workerSettings: typeof DEFAULT_WORKER_SETTINGS;
};

let lastLoadedStoredSettings: STORED_SETTINGS | null = null;

export function loadSettings() {
  let loadedSettings: STORED_SETTINGS = {};

  try {
    if (typeof window !== "undefined" && window.localStorage) {
      if (
        typeof window !== "undefined" &&
        window.localStorage &&
        window.localStorage.getItem(STORED_SETTINGS_KEY)
      ) {
        loadedSettings = JSON.parse(
          window.localStorage.getItem(STORED_SETTINGS_KEY) as string
        );
        lastLoadedStoredSettings = loadedSettings;
      }
    }
  } catch (err) {
    console.error(
      "Error loading settings from localStorage, loading saved settings if we have them",
      lastLoadedStoredSettings
    );
    // This is just to avoid the headache of drilling in the window object to the workers
    if (lastLoadedStoredSettings) {
      console.log("Using last loaded settings - ", lastLoadedStoredSettings);
      loadedSettings = lastLoadedStoredSettings;
    }
  }

  loadedSettings.packetDBSettings = {
    ...DEFAULT_PACKET_DB_SETTINGS,
    ...loadedSettings.packetDBSettings,
  };

  loadedSettings.p2pSettings = {
    ...DEFAULT_P2P_SETTINGS,

    ...loadedSettings.p2pSettings,
  };

  loadedSettings.chainConnectionSettings = {
    ...DEFAULT_CHAIN_CONNECTION_SETTINGS,
    ...loadedSettings.chainConnectionSettings,
  };

  loadedSettings.loggerSettings = {
    ...DEFAULT_LOGGER_SETTINGS,
    ...loadedSettings.loggerSettings,
  };

  loadedSettings.theDomainSettings = {
    ...DEFAULT_THEDOMAIN_SETTINGS,
    ...loadedSettings.theDomainSettings,
  };

  loadedSettings.quorumSettings = {
    ...DEFAULT_QUORUM_SETTINGS,
    ...loadedSettings.quorumSettings,
  };

  loadedSettings.llmEngineSettings = {
    ...DEFAULT_LLM_ENGINE_SETTINGS,
    ...loadedSettings.llmEngineSettings,
  };

  loadedSettings.workerSettings = {
    ...DEFAULT_WORKER_SETTINGS,
    ...loadedSettings.workerSettings,
  };

  // DOn't get much type safety here, need to be careful
  return loadedSettings as LOADED_SETTINGS;
}

export function saveSettings(partialSettings: Partial<STORED_SETTINGS>) {
  if (typeof window !== "undefined") {
    let existingSettings = {};

    try {
      existingSettings = JSON.parse(
        window.localStorage.getItem(STORED_SETTINGS_KEY) as string
      );
    } catch (err) {
      console.error("Error parsing existing settings", err);
    }
    window.localStorage.setItem(
      STORED_SETTINGS_KEY,
      JSON.stringify({ ...existingSettings, ...partialSettings })
    );
  }
}

export const DEFAULT_WORKER_SETTINGS: {
  initialEmbeddingWorkers: {
    modelName: EmbeddingModelName;
    count: number;
  }[];
  initialLLMWorkers: {
    modelName: LLMModelName;
    count: number;
  }[];
} = {
  initialLLMWorkers: [{ modelName: "gemma-2b-it-q4f16_1", count: 2 }],
  initialEmbeddingWorkers: [
    { modelName: "nomic-ai/nomic-embed-text-v1.5", count: 1 },
  ],
};

export const DEFAULT_PACKET_DB_SETTINGS: {
  maxReceivedPacketQueueSize: number;
  receivePacketQueueDebounceMs: number;
  peerHeartLimit: number;
  peerCommunicationCount: number; // Expected number of people (probabilistically enforced) who will pipe up with a peer list when you join
  maxPacketDBSize: number; // Number of packets to keep in database
} = {
  maxReceivedPacketQueueSize: 100,
  receivePacketQueueDebounceMs: 100,
  peerHeartLimit: 20,
  peerCommunicationCount: 40,
  maxPacketDBSize: 5000,
};

export const DEFAULT_P2P_SETTINGS: {
  topic: string;
  maxTransmissionErrorsBeforeRestart: number;
} = {
  topic: "rakis1",
  maxTransmissionErrorsBeforeRestart: 5,
};

export const DEFAULT_CHAIN_CONNECTION_SETTINGS: {
  dAppName: string;
  url: string;
} = {
  dAppName: "Rakis",
  url: "https://rakis.ai",
};

export const DEFAULT_IDENTITY_ENCRYPTED_KEY = "encSynthientId";

export const DEFAULT_LOGGER_SETTINGS: {
  maxLogsInMemory: number;
  loggersToSkipForInMemoryLog: string[];
  newLogEventDebounceMs: number;
} = {
  maxLogsInMemory: 1000,
  loggersToSkipForInMemoryLog: [
    "P2P: NKN",
    "P2P: PewPewDB",
    "P2P: nostr (trystero)",
    "P2P: torrent (trystero)",
    "PacketDB",
  ],
  newLogEventDebounceMs: 150,
};

export const DEFAULT_THEDOMAIN_SETTINGS: {
  enabledP2PNetworks: SupportedP2PDeliveryNetwork[];
  waitForP2PBootupMs: number;
  inferencePollingIntervalMs: number;
  inferenceRequestQueueDebounceMs: number;
  embeddingsQueueDebounceMs: number;
  requestSimilarityTimeWindowMs: number; // Inferences this close together we'll choose from proabilistically
} = {
  enabledP2PNetworks: ["nostr", "gun", "torrent", "nkn"],
  waitForP2PBootupMs: 5000,
  inferencePollingIntervalMs: 5000,
  inferenceRequestQueueDebounceMs: 1000,
  embeddingsQueueDebounceMs: 100,
  requestSimilarityTimeWindowMs: 2000,
};

export const DEFAULT_QUORUM_SETTINGS: {
  // TODO: This is being sent out but not really enforced
  quorumRevealTimeoutMs: number; // Amount of time allowed between endingAt and quorum reveals being received
  quorumRevealRequestIssueTimeoutMs: number; // Amount of time allowed between endingAt and quorum reveal requests going out
  quorumConsensusWindowMs: number; // Amount of time after reveal timeout that is allowed for consensus processing
  bEmbeddingThreshold: number; // Distance that our recomputed embeddings are allowed to be off by
} = {
  quorumRevealRequestIssueTimeoutMs: 15000,
  quorumRevealTimeoutMs: 35000,
  quorumConsensusWindowMs: 40000,
  bEmbeddingThreshold: 0,
};

export const DEFAULT_LLM_ENGINE_SETTINGS: {
  engineLogLimit: number;
  debounceLoadingProgressEventMs: number;
} = {
  engineLogLimit: 2000,
  debounceLoadingProgressEventMs: 50,
};
