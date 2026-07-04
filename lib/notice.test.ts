// @vitest-environment node
import { describe, it, expect } from "vitest";

import { isNoticeActive, activeNoticeWhere } from "@/lib/notice";

const now = new Date("2026-07-04T12:00:00.000Z");
const past = new Date("2026-07-01T00:00:00.000Z");
const future = new Date("2026-07-10T00:00:00.000Z");

describe("isNoticeActive", () => {
  it("is false when the flag is off", () => {
    expect(
      isNoticeActive({ active: false, startsAt: null, endsAt: null }, now),
    ).toBe(false);
  });

  it("is true when active with no window", () => {
    expect(
      isNoticeActive({ active: true, startsAt: null, endsAt: null }, now),
    ).toBe(true);
  });

  it("respects a start that hasn't arrived", () => {
    expect(
      isNoticeActive({ active: true, startsAt: future, endsAt: null }, now),
    ).toBe(false);
  });

  it("respects an end that has passed", () => {
    expect(
      isNoticeActive({ active: true, startsAt: null, endsAt: past }, now),
    ).toBe(false);
  });

  it("is true within an open window", () => {
    expect(
      isNoticeActive({ active: true, startsAt: past, endsAt: future }, now),
    ).toBe(true);
  });
});

describe("activeNoticeWhere", () => {
  it("builds the Prisma where for currently-active notices", () => {
    expect(activeNoticeWhere(now)).toEqual({
      active: true,
      AND: [
        { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
        { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
      ],
    });
  });
});
