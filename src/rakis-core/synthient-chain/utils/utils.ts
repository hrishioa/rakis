import {
  DEFAULT_CHAIN_CONNECTION_SETTINGS,
  DEFAULT_WORKER_SETTINGS,
  DEFAULT_IDENTITY_ENCRYPTED_KEY,
  DEFAULT_LLM_ENGINE_SETTINGS,
  DEFAULT_LOGGER_SETTINGS,
  DEFAULT_P2P_SETTINGS,
  DEFAULT_PACKET_DB_SETTINGS,
  DEFAULT_QUORUM_SETTINGS,
  STORED_SETTINGS,
  STORED_SETTINGS_KEY,
  DEFAULT_THEDOMAIN_SETTINGS,
  LOADED_SETTINGS,
} from "../thedomain/settings";

export function loadSettings() {
  let loadedSettings: STORED_SETTINGS = {};

  try {
    if (
      typeof window !== "undefined" &&
      window.localStorage.getItem(STORED_SETTINGS_KEY)
    )
      loadedSettings = JSON.parse(
        window.localStorage.getItem(STORED_SETTINGS_KEY) as string
      );
  } catch (err) {
    console.error("Error loading settings from localStorage", err);
  }

  loadedSettings.packetDBSettings = {
    ...loadedSettings.packetDBSettings,
    ...DEFAULT_PACKET_DB_SETTINGS,
  };

  loadedSettings.identityEncryptedKey =
    loadedSettings.identityEncryptedKey || DEFAULT_IDENTITY_ENCRYPTED_KEY;

  loadedSettings.p2pSettings = {
    ...loadedSettings.p2pSettings,
    ...DEFAULT_P2P_SETTINGS,
  };

  loadedSettings.chainConnectionSettings = {
    ...loadedSettings.chainConnectionSettings,
    ...DEFAULT_CHAIN_CONNECTION_SETTINGS,
  };

  loadedSettings.loggerSettings = {
    ...loadedSettings.loggerSettings,
    ...DEFAULT_LOGGER_SETTINGS,
  };

  loadedSettings.theDomainSettings = {
    ...loadedSettings.theDomainSettings,
    ...DEFAULT_THEDOMAIN_SETTINGS,
  };

  loadedSettings.quorumSettings = {
    ...loadedSettings.quorumSettings,
    ...DEFAULT_QUORUM_SETTINGS,
  };

  loadedSettings.llmEngineSettings = {
    ...loadedSettings.llmEngineSettings,
    ...DEFAULT_LLM_ENGINE_SETTINGS,
  };

  loadedSettings.workerSettings = {
    ...loadedSettings.workerSettings,
    ...DEFAULT_WORKER_SETTINGS,
  };

  // DOn't get much type safety here, need to be careful
  return loadedSettings as LOADED_SETTINGS;
}

export function saveSettings(partialSettings: Partial<STORED_SETTINGS>) {
  if (typeof window !== "undefined") {
    const existingSettings = loadSettings();
    window.localStorage.setItem(
      STORED_SETTINGS_KEY,
      JSON.stringify({ ...partialSettings, ...existingSettings })
    );
  }
}

export function stringifyDateWithOffset(date: Date) {
  // Convert date to local time by subtracting the timezone offset
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);

  // Generate ISO string in local time
  const isoString = localDate.toISOString();

  // Replace 'Z' with the actual timezone offset formatted as `±hh:mm`
  const timezoneOffset = date.getTimezoneOffset();
  const offsetSign = timezoneOffset > 0 ? "-" : "+";
  // Jesus H Christ the abs and floor being switched around from Claude was such a wild goose chase
  const offsetHours = Math.floor(Math.abs(timezoneOffset / 60))
    .toString()
    .padStart(2, "0");
  const offsetMinutes = Math.abs(timezoneOffset % 60)
    .toString()
    .padStart(2, "0");
  return `${isoString.slice(
    0,
    -1
  )}${offsetSign}${offsetHours}:${offsetMinutes}`;
}

export function getDeviceInfo() {
  if (typeof navigator === "undefined" || typeof screen === "undefined") {
    return "not-client";
  }

  if ((window as any).disableAnalytics) return "disabled-analytics";

  const info = {
    userAgent: navigator.userAgent,
    browserVersion: navigator.appVersion,
    platform: navigator.platform,
    language: navigator.language,
    screenWidth: screen.width,
    screenHeight: screen.height,
    colorDepth: screen.colorDepth,
    timezoneOffset: new Date().getTimezoneOffset(),
    cpuCores: navigator.hardwareConcurrency,
    touchSupport: "ontouchstart" in window,
  };

  return Object.values(info)
    .map((val) => `${val}`)
    .join("#");
}

export async function timeoutPromise(ms: number): Promise<"timeout"> {
  return new Promise((resolve) => {
    setTimeout(() => resolve("timeout"), ms);
  });
}

export function generateRandomString(length: number = 6): string {
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}
