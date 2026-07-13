// Human-readable "how long ago" for admin lists: coarse buckets are enough to
// spot recent additions and restocks at a glance; hover shows the full date.

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
const MONTH = 30 * DAY;
const YEAR = 365 * DAY;

const UNITS: Array<[ms: number, label: string]> = [
  [YEAR, "year"],
  [MONTH, "month"],
  [WEEK, "week"],
  [DAY, "day"],
  [HOUR, "hour"],
  [MINUTE, "minute"],
];

export function relativeDate(
  date: Date | string,
  now: Date = new Date(),
): string {
  const elapsed = now.getTime() - new Date(date).getTime();
  for (const [ms, label] of UNITS) {
    if (elapsed >= ms) {
      const count = Math.floor(elapsed / ms);
      return `${count} ${label}${count === 1 ? "" : "s"} ago`;
    }
  }
  return "just now";
}

// Full date for hover titles, pinned to the shop's timezone so it reads the
// same regardless of server locale.
const FULL = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Amsterdam",
});

export function fullDate(date: Date | string): string {
  return FULL.format(new Date(date));
}
