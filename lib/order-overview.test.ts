// @vitest-environment node
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

vi.mock("@/lib/db", () => ({ db: { supplyOrderLine: { findMany: vi.fn() } } }));

import { db } from "@/lib/db";
import { getOpenOrderLines } from "@/lib/order-overview";

const findMany = (db.supplyOrderLine as unknown as { findMany: Mock }).findMany;

function makeLine(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "l1",
    quantityOrdered: 5,
    quantityReceived: 0,
    createdAt: new Date("2026-08-03T10:00:00Z"), // a Monday
    supplyOrder: { id: "o1", status: "PENDING", sentAt: null, supplier: { id: "s1", name: "Beta" } },
    product: {
      id: "p1",
      title: "Torus",
      catalogNumber: "ZR-001",
      label: { name: "Zulema" },
      productType: { name: "LP" },
      productArtists: [{ position: 0, artist: { name: "Vril" } }],
    },
    ...overrides,
  };
}

beforeEach(() => vi.clearAllMocks());

describe("getOpenOrderLines", () => {
  it("queries only non-RECEIVED lines, newest first", async () => {
    findMany.mockResolvedValue([]);
    await getOpenOrderLines("flat");
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { supplyOrder: { status: { not: "RECEIVED" } } },
        orderBy: { createdAt: "desc" },
      }),
    );
  });

  it("flat: returns the lines as-is", async () => {
    const line = makeLine();
    findMany.mockResolvedValue([line]);
    const result = await getOpenOrderLines("flat");
    expect(result).toEqual({ groupBy: "flat", lines: [line] });
  });

  it("supplier: groups lines by supplier, sorted alphabetically", async () => {
    const betaLine = makeLine({
      supplyOrder: { id: "o1", status: "PENDING", sentAt: null, supplier: { id: "s1", name: "Beta" } },
    });
    const alphaSentAt = new Date("2026-08-02T09:00:00Z");
    const alphaLine = makeLine({
      id: "l2",
      supplyOrder: { id: "o2", status: "PARTIAL", sentAt: alphaSentAt, supplier: { id: "s2", name: "Alpha" } },
    });
    findMany.mockResolvedValue([betaLine, alphaLine]);
    const result = await getOpenOrderLines("supplier");
    expect(result.groupBy).toBe("supplier");
    if (result.groupBy !== "supplier") return;
    expect(result.groups.map((g) => g.supplier.name)).toEqual(["Alpha", "Beta"]);
    expect(result.groups[0]).toEqual({
      supplier: { id: "s2", name: "Alpha" },
      order: { id: "o2", status: "PARTIAL", sentAt: alphaSentAt },
      lines: [alphaLine],
    });
    expect(result.groups[1]).toEqual({
      supplier: { id: "s1", name: "Beta" },
      order: { id: "o1", status: "PENDING", sentAt: null },
      lines: [betaLine],
    });
  });

  it("date: groups lines by the shop week (Mon-Sun) they were added, newest week first", async () => {
    const thisWeek = makeLine({ createdAt: new Date("2026-08-03T10:00:00Z") }); // Monday
    const lastWeek = makeLine({ id: "l2", createdAt: new Date("2026-07-27T10:00:00Z") });
    findMany.mockResolvedValue([thisWeek, lastWeek]);
    const result = await getOpenOrderLines("date");
    expect(result.groupBy).toBe("date");
    if (result.groupBy !== "date") return;
    expect(result.groups).toHaveLength(2);
    expect(result.groups[0].lines).toEqual([thisWeek]);
    expect(result.groups[1].lines).toEqual([lastWeek]);
    expect(result.groups[0].weekStart.getTime()).toBeGreaterThan(result.groups[1].weekStart.getTime());
  });
});
