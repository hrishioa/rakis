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
