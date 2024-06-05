export function stringifyDateWithOffset(date: Date) {
  const isoString = date.toISOString();
  const timezoneOffset = date.getTimezoneOffset();
  const offsetSign = timezoneOffset > 0 ? "-" : "+";
  const offsetHours = Math.abs(Math.floor(timezoneOffset / 60))
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
