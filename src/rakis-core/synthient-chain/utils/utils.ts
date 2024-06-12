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
