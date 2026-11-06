import { describe, it, expect } from "vitest";

import { fullDate, relativeDate } from "@/lib/relative-date";

const NOW = new Date("2026-07-13T12:00:00Z");
const ago = (ms: number) => new Date(NOW.getTime() - ms);
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

describe("relativeDate", () => {
  describe("English", () => {
    it("says 'just now' within the first minute", () => {
      expect(relativeDate(ago(0), "EN", NOW)).toBe("just now");
      expect(relativeDate(ago(59_000), "EN", NOW)).toBe("just now");
    });

    it("counts minutes under an hour", () => {
      expect(relativeDate(ago(MIN), "EN", NOW)).toBe("1 minute ago");
      expect(relativeDate(ago(45 * MIN), "EN", NOW)).toBe("45 minutes ago");
    });

    it("counts hours under a day", () => {
      expect(relativeDate(ago(HOUR), "EN", NOW)).toBe("1 hour ago");
      expect(relativeDate(ago(23 * HOUR), "EN", NOW)).toBe("23 hours ago");
    });

    it("counts days under a week", () => {
      expect(relativeDate(ago(DAY), "EN", NOW)).toBe("1 day ago");
      expect(relativeDate(ago(3 * DAY), "EN", NOW)).toBe("3 days ago");
    });

    it("counts weeks under a month", () => {
      expect(relativeDate(ago(7 * DAY), "EN", NOW)).toBe("1 week ago");
      expect(relativeDate(ago(20 * DAY), "EN", NOW)).toBe("2 weeks ago");
    });

    it("counts months under a year", () => {
      expect(relativeDate(ago(31 * DAY), "EN", NOW)).toBe("1 month ago");
      expect(relativeDate(ago(200 * DAY), "EN", NOW)).toBe("6 months ago");
    });

    it("counts years beyond that", () => {
      expect(relativeDate(ago(400 * DAY), "EN", NOW)).toBe("1 year ago");
      expect(relativeDate(ago(800 * DAY), "EN", NOW)).toBe("2 years ago");
    });

    it("accepts date strings", () => {
      expect(relativeDate("2026-07-10T12:00:00Z", "EN", NOW)).toBe("3 days ago");
    });
  });

  describe("Dutch", () => {
    it("says 'zojuist' within the first minute", () => {
      expect(relativeDate(ago(0), "NL", NOW)).toBe("zojuist");
      expect(relativeDate(ago(59_000), "NL", NOW)).toBe("zojuist");
    });

    it("counts minutes under an hour", () => {
      expect(relativeDate(ago(MIN), "NL", NOW)).toBe("1 minuut geleden");
      expect(relativeDate(ago(45 * MIN), "NL", NOW)).toBe("45 minuten geleden");
    });

    it("counts hours under a day, with an invariant plural", () => {
      expect(relativeDate(ago(HOUR), "NL", NOW)).toBe("1 uur geleden");
      expect(relativeDate(ago(23 * HOUR), "NL", NOW)).toBe("23 uur geleden");
    });

    it("counts days under a week", () => {
      expect(relativeDate(ago(DAY), "NL", NOW)).toBe("1 dag geleden");
      expect(relativeDate(ago(3 * DAY), "NL", NOW)).toBe("3 dagen geleden");
    });

    it("counts weeks under a month", () => {
      expect(relativeDate(ago(7 * DAY), "NL", NOW)).toBe("1 week geleden");
      expect(relativeDate(ago(20 * DAY), "NL", NOW)).toBe("2 weken geleden");
    });

    it("counts months under a year", () => {
      expect(relativeDate(ago(31 * DAY), "NL", NOW)).toBe("1 maand geleden");
      expect(relativeDate(ago(200 * DAY), "NL", NOW)).toBe("6 maanden geleden");
    });

    it("counts years beyond that", () => {
      expect(relativeDate(ago(400 * DAY), "NL", NOW)).toBe("1 jaar geleden");
      expect(relativeDate(ago(800 * DAY), "NL", NOW)).toBe("2 jaar geleden");
    });
  });
});

describe("fullDate", () => {
  it("formats the full date and time for hover titles in English (shop timezone)", () => {
    // 12:00 UTC in July is 14:00 in Europe/Amsterdam (CEST).
    expect(fullDate(NOW, "EN")).toBe("13 Jul 2026, 14:00");
  });

  it("formats the full date and time for hover titles in Dutch (shop timezone)", () => {
    expect(fullDate(NOW, "NL")).toBe("13 jul 2026, 14:00");
  });
});
