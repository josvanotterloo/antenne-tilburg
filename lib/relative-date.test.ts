import { describe, it, expect } from "vitest";

import { fullDate, relativeDate } from "@/lib/relative-date";

const NOW = new Date("2026-07-13T12:00:00Z");
const ago = (ms: number) => new Date(NOW.getTime() - ms);
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

describe("relativeDate", () => {
  it("says 'just now' within the first minute", () => {
    expect(relativeDate(ago(0), NOW)).toBe("just now");
    expect(relativeDate(ago(59_000), NOW)).toBe("just now");
  });

  it("counts minutes under an hour", () => {
    expect(relativeDate(ago(MIN), NOW)).toBe("1 minute ago");
    expect(relativeDate(ago(45 * MIN), NOW)).toBe("45 minutes ago");
  });

  it("counts hours under a day", () => {
    expect(relativeDate(ago(HOUR), NOW)).toBe("1 hour ago");
    expect(relativeDate(ago(23 * HOUR), NOW)).toBe("23 hours ago");
  });

  it("counts days under a week", () => {
    expect(relativeDate(ago(DAY), NOW)).toBe("1 day ago");
    expect(relativeDate(ago(3 * DAY), NOW)).toBe("3 days ago");
  });

  it("counts weeks under a month", () => {
    expect(relativeDate(ago(7 * DAY), NOW)).toBe("1 week ago");
    expect(relativeDate(ago(20 * DAY), NOW)).toBe("2 weeks ago");
  });

  it("counts months under a year", () => {
    expect(relativeDate(ago(31 * DAY), NOW)).toBe("1 month ago");
    expect(relativeDate(ago(200 * DAY), NOW)).toBe("6 months ago");
  });

  it("counts years beyond that", () => {
    expect(relativeDate(ago(400 * DAY), NOW)).toBe("1 year ago");
    expect(relativeDate(ago(800 * DAY), NOW)).toBe("2 years ago");
  });

  it("accepts date strings", () => {
    expect(relativeDate("2026-07-10T12:00:00Z", NOW)).toBe("3 days ago");
  });
});

describe("fullDate", () => {
  it("formats the full date and time for hover titles (shop timezone)", () => {
    // 12:00 UTC in July is 14:00 in Europe/Amsterdam (CEST).
    expect(fullDate(NOW)).toBe("13 Jul 2026, 14:00");
  });
});
