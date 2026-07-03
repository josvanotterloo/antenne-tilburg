import { slugify } from "@/lib/slug";

// Validation/normalization for events. Status is derived from the date (not a
// manual toggle) via eventStatus, computed by the route on write.

export const DEFAULT_LOCATION = "Antenne / Sam-Sam, Tilburg";

export interface EventInput {
  title: string;
  slug: string;
  date: Date;
  description: string | null;
  image: string | null;
  location: string;
  seoTitle: string | null;
  seoDescription: string | null;
}

export type ParseResult =
  | { ok: true; data: EventInput }
  | { ok: false; error: string };

export function parseEventInput(body: unknown): ParseResult {
  const b = (body ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

  const title = str(b.title);
  if (!title) return { ok: false, error: "Title is required" };

  const rawDate = str(b.date);
  const date = new Date(rawDate);
  if (!rawDate || Number.isNaN(date.getTime())) {
    return { ok: false, error: "A valid date is required" };
  }

  const slug = slugify(str(b.slug)) || slugify(title);
  if (!slug) return { ok: false, error: "Could not generate a slug" };

  return {
    ok: true,
    data: {
      title,
      slug,
      date,
      description: str(b.description) || null,
      image: str(b.image) || null,
      location: str(b.location) || DEFAULT_LOCATION,
      seoTitle: str(b.seoTitle) || null,
      seoDescription: str(b.seoDescription) || null,
    },
  };
}

// Format a Date as a datetime-local value (YYYY-MM-DDTHH:mm) using LOCAL
// components, so it re-parses (via `new Date`) to the same instant the API
// stored — a UTC-formatted value would drift by the timezone offset on edit.
export function toDateTimeLocal(date: Date): string {
  const d = new Date(date);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Derive status from the event date. `now` injectable for tests.
export function eventStatus(
  date: Date,
  now: Date = new Date(),
): "UPCOMING" | "PAST" {
  return date.getTime() >= now.getTime() ? "UPCOMING" : "PAST";
}
