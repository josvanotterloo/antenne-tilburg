// Human-readable "how long ago" for admin lists: coarse buckets are enough to
// spot recent additions and restocks at a glance; hover shows the full date.

import type { AdminLocale } from "@prisma/client";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
const MONTH = 30 * DAY;
const YEAR = 365 * DAY;

interface UnitWords {
  singular: string;
  plural: string;
}

const UNITS: Array<{ ms: number; en: UnitWords; nl: UnitWords }> = [
  { ms: YEAR, en: { singular: "year", plural: "years" }, nl: { singular: "jaar", plural: "jaar" } },
  { ms: MONTH, en: { singular: "month", plural: "months" }, nl: { singular: "maand", plural: "maanden" } },
  { ms: WEEK, en: { singular: "week", plural: "weeks" }, nl: { singular: "week", plural: "weken" } },
  { ms: DAY, en: { singular: "day", plural: "days" }, nl: { singular: "dag", plural: "dagen" } },
  { ms: HOUR, en: { singular: "hour", plural: "hours" }, nl: { singular: "uur", plural: "uur" } },
  { ms: MINUTE, en: { singular: "minute", plural: "minutes" }, nl: { singular: "minuut", plural: "minuten" } },
];

export function relativeDate(
  date: Date | string,
  locale: AdminLocale,
  now: Date = new Date(),
): string {
  const elapsed = now.getTime() - new Date(date).getTime();
  for (const unit of UNITS) {
    if (elapsed >= unit.ms) {
      const count = Math.floor(elapsed / unit.ms);
      const words = locale === "EN" ? unit.en : unit.nl;
      const word = count === 1 ? words.singular : words.plural;
      return locale === "EN" ? `${count} ${word} ago` : `${count} ${word} geleden`;
    }
  }
  return locale === "EN" ? "just now" : "zojuist";
}

// Full date for hover titles, pinned to the shop's timezone so it reads the
// same regardless of server locale.
const FULL_FORMATTERS: Record<AdminLocale, Intl.DateTimeFormat> = {
  EN: new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Amsterdam",
  }),
  NL: new Intl.DateTimeFormat("nl-NL", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Amsterdam",
  }),
};

export function fullDate(date: Date | string, locale: AdminLocale): string {
  return FULL_FORMATTERS[locale].format(new Date(date));
}
