// @vitest-environment node
import { describe, it, expect } from "vitest";

import {
  parseOpeningHoursInput,
  DAY_NAMES,
  WEEK_ORDER,
  formatHourRange,
  orderOpeningHours,
} from "@/lib/opening-hours";

const openRow = (dayOfWeek: number) => ({
  dayOfWeek,
  opensAt: "12:00",
  closesAt: "18:00",
  closed: false,
});

describe("parseOpeningHoursInput", () => {
  it("accepts valid rows", () => {
    const r = parseOpeningHoursInput({ hours: [openRow(2), openRow(3)] });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data).toHaveLength(2);
    expect(r.data[0]).toEqual({
      dayOfWeek: 2,
      opensAt: "12:00",
      closesAt: "18:00",
      closed: false,
    });
  });

  it("defaults times for a closed day with blank times", () => {
    const r = parseOpeningHoursInput({
      hours: [{ dayOfWeek: 1, opensAt: "", closesAt: "", closed: true }],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data[0]).toMatchObject({
      closed: true,
      opensAt: "00:00",
      closesAt: "00:00",
    });
  });

  it("rejects a dayOfWeek out of range", () => {
    expect(parseOpeningHoursInput({ hours: [openRow(7)] }).ok).toBe(false);
  });

  it("rejects an open day with an invalid time", () => {
    expect(
      parseOpeningHoursInput({
        hours: [{ dayOfWeek: 1, opensAt: "9am", closesAt: "18:00", closed: false }],
      }).ok,
    ).toBe(false);
  });

  it("rejects an open day where close is not after open", () => {
    expect(
      parseOpeningHoursInput({
        hours: [{ dayOfWeek: 1, opensAt: "18:00", closesAt: "12:00", closed: false }],
      }).ok,
    ).toBe(false);
  });

  it("rejects a non-array payload", () => {
    expect(parseOpeningHoursInput({}).ok).toBe(false);
  });
});

describe("day helpers", () => {
  it("names days from Sunday=0", () => {
    expect(DAY_NAMES[0]).toBe("Sunday");
    expect(DAY_NAMES[1]).toBe("Monday");
  });
  it("orders the week Monday-first", () => {
    expect(WEEK_ORDER).toEqual([1, 2, 3, 4, 5, 6, 0]);
  });
});

describe("formatHourRange", () => {
  it("renders an open day as opens–closes", () => {
    expect(
      formatHourRange({ opensAt: "12:00", closesAt: "18:00", closed: false }),
    ).toBe("12:00–18:00");
  });
  it("renders a closed day as Closed", () => {
    expect(
      formatHourRange({ opensAt: "00:00", closesAt: "00:00", closed: true }),
    ).toBe("Closed");
  });
});

describe("orderOpeningHours", () => {
  it("reorders rows Monday-first regardless of input order", () => {
    const rows = [0, 3, 1].map((dayOfWeek) => ({ dayOfWeek }));
    expect(orderOpeningHours(rows).map((r) => r.dayOfWeek)).toEqual([1, 3, 0]);
  });
  it("skips days that are missing from the input", () => {
    const rows = [{ dayOfWeek: 2 }, { dayOfWeek: 6 }];
    expect(orderOpeningHours(rows).map((r) => r.dayOfWeek)).toEqual([2, 6]);
  });
});
