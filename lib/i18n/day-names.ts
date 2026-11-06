import type { AdminLocale } from "@prisma/client";

// Admin-only Dutch/English weekday names, keyed the same way as
// lib/opening-hours.ts's DAY_NAMES (0=Sunday..6=Saturday) — but never
// imported from or into that file. DAY_NAMES is shared with the public
// Visit page and footer and must stay English; this is a separate lookup
// so the admin hours editor can show Dutch without touching it.
const DAY_NAME_LABELS: Record<number, { nl: string; en: string }> = {
  0: { nl: "Zondag", en: "Sunday" },
  1: { nl: "Maandag", en: "Monday" },
  2: { nl: "Dinsdag", en: "Tuesday" },
  3: { nl: "Woensdag", en: "Wednesday" },
  4: { nl: "Donderdag", en: "Thursday" },
  5: { nl: "Vrijdag", en: "Friday" },
  6: { nl: "Zaterdag", en: "Saturday" },
};

export function dayName(dayOfWeek: number, locale: AdminLocale): string {
  const label = DAY_NAME_LABELS[dayOfWeek];
  return locale === "EN" ? label.en : label.nl;
}
