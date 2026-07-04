// Opening hours: a fixed set of weekday rows (dayOfWeek 0=Sunday..6=Saturday).
// The admin bulk-edits all rows; validation normalizes the payload.

export const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

// Display order — the shop thinks Monday-first.
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

export interface HourRow {
  dayOfWeek: number;
  opensAt: string;
  closesAt: string;
  closed: boolean;
}

// "12:00–18:00" for an open day, "Closed" otherwise. Shared by the footer and
// the Visit page so both read hours identically.
export function formatHourRange(row: {
  opensAt: string;
  closesAt: string;
  closed: boolean;
}): string {
  return row.closed ? "Closed" : `${row.opensAt}–${row.closesAt}`;
}

// Reorder day rows Monday-first (WEEK_ORDER); days absent from the input are skipped.
export function orderOpeningHours<T extends { dayOfWeek: number }>(
  rows: T[],
): T[] {
  return WEEK_ORDER.map((day) =>
    rows.find((r) => r.dayOfWeek === day),
  ).filter((r): r is T => r !== undefined);
}

export type ParseResult =
  | { ok: true; data: HourRow[] }
  | { ok: false; error: string };

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isValidTime(s: string): boolean {
  return TIME_RE.test(s);
}

export function parseOpeningHoursInput(body: unknown): ParseResult {
  const rows = (body as { hours?: unknown } | null)?.hours;
  if (!Array.isArray(rows)) {
    return { ok: false, error: "Expected a list of opening hours" };
  }

  const data: HourRow[] = [];
  for (const raw of rows) {
    const r = (raw ?? {}) as Record<string, unknown>;
    const dayOfWeek = r.dayOfWeek;
    if (
      typeof dayOfWeek !== "number" ||
      !Number.isInteger(dayOfWeek) ||
      dayOfWeek < 0 ||
      dayOfWeek > 6
    ) {
      return { ok: false, error: "Invalid day of week" };
    }

    const closed = r.closed === true;
    const opensAt = typeof r.opensAt === "string" ? r.opensAt.trim() : "";
    const closesAt = typeof r.closesAt === "string" ? r.closesAt.trim() : "";

    if (closed) {
      data.push({
        dayOfWeek,
        opensAt: isValidTime(opensAt) ? opensAt : "00:00",
        closesAt: isValidTime(closesAt) ? closesAt : "00:00",
        closed: true,
      });
      continue;
    }

    if (!isValidTime(opensAt) || !isValidTime(closesAt)) {
      return {
        ok: false,
        error: `Valid open/close times required for ${DAY_NAMES[dayOfWeek]}`,
      };
    }
    if (closesAt <= opensAt) {
      return {
        ok: false,
        error: `Closing time must be after opening on ${DAY_NAMES[dayOfWeek]}`,
      };
    }

    data.push({ dayOfWeek, opensAt, closesAt, closed: false });
  }

  return { ok: true, data };
}
