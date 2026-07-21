// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: { openingHours: { findMany: vi.fn() } },
}));

import {
  parseOpeningHoursInput,
  DAY_NAMES,
  WEEK_ORDER,
  formatHourRange,
  orderOpeningHours,
  toOpeningHoursSpecification,
  getOpeningHours,
} from "@/lib/opening-hours";
import { db } from "@/lib/db";

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

describe("toOpeningHoursSpecification", () => {
  it("maps open days to schema.org OpeningHoursSpecification entries", () => {
    const spec = toOpeningHoursSpecification([openRow(1)]);
    expect(spec).toEqual([
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: "Monday",
        opens: "12:00",
        closes: "18:00",
      },
    ]);
  });

  it("omits closed days", () => {
    const rows = [
      openRow(1),
      { dayOfWeek: 0, opensAt: "00:00", closesAt: "00:00", closed: true },
    ];
    expect(toOpeningHoursSpecification(rows)).toHaveLength(1);
  });
});

describe("getOpeningHours", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns hours ordered Monday-first", async () => {
    vi.mocked(db.openingHours.findMany).mockResolvedValue([
      openRow(0),
      openRow(1),
    ] as never);
    const hours = await getOpeningHours();
    expect(hours.map((r) => r.dayOfWeek)).toEqual([1, 0]);
  });

  it("degrades to an empty list if the DB call fails", async () => {
    vi.mocked(db.openingHours.findMany).mockRejectedValue(new Error("db down"));
    expect(await getOpeningHours()).toEqual([]);
  });
});
