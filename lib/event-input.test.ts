// @vitest-environment node
import { describe, it, expect } from "vitest";

import {
  parseEventInput,
  eventStatus,
  toDateTimeLocal,
  DEFAULT_LOCATION,
} from "@/lib/event-input";

const VALID = {
  title: "  Label Night  ",
  date: "2026-08-01T20:00:00.000Z",
  description: "  ",
  image: "https://x/y.jpg",
  location: "",
  seoTitle: "SEO",
  seoDescription: "",
};

describe("parseEventInput", () => {
  it("accepts valid input, derives a slug, defaults location", () => {
    const r = parseEventInput(VALID);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.title).toBe("Label Night");
    expect(r.data.slug).toBe("label-night");
    expect(r.data.date.toISOString()).toBe("2026-08-01T20:00:00.000Z");
    expect(r.data.description).toBeNull();
    expect(r.data.image).toBe("https://x/y.jpg");
    expect(r.data.location).toBe(DEFAULT_LOCATION);
    expect(r.data.seoDescription).toBeNull();
  });

  it("respects an explicit location and slug", () => {
    const r = parseEventInput({
      ...VALID,
      location: "Paradiso",
      slug: "Custom!",
    });
    expect(r.ok && r.data.location).toBe("Paradiso");
    expect(r.ok && r.data.slug).toBe("custom");
  });

  it.each([
    ["title", { ...VALID, title: "" }],
    ["date (missing)", { ...VALID, date: "" }],
    ["date (invalid)", { ...VALID, date: "not-a-date" }],
  ])("rejects %s", (_f, body) => {
    expect(parseEventInput(body).ok).toBe(false);
  });
});

describe("toDateTimeLocal", () => {
  it("round-trips through Date without timezone drift", () => {
    // The edit form value must re-parse (as local, like the API) to the same
    // instant — a UTC-formatted value would shift by the tz offset.
    const d = new Date(2026, 7, 1, 20, 0); // local 2026-08-01 20:00
    expect(new Date(toDateTimeLocal(d)).getTime()).toBe(d.getTime());
  });

  it("produces a datetime-local shaped string", () => {
    expect(toDateTimeLocal(new Date(2026, 0, 5, 9, 3))).toBe(
      "2026-01-05T09:03",
    );
  });
});

describe("eventStatus", () => {
  const now = new Date("2026-07-03T00:00:00.000Z");
  it("is UPCOMING for a future date", () => {
    expect(eventStatus(new Date("2026-08-01T00:00:00Z"), now)).toBe("UPCOMING");
  });
  it("is PAST for a past date", () => {
    expect(eventStatus(new Date("2026-05-01T00:00:00Z"), now)).toBe("PAST");
  });
});
