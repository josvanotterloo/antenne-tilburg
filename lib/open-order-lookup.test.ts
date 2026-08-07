// @vitest-environment node
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    supplyOrderLine: {
      findMany: vi.fn(),
      fields: { quantityOrdered: "quantityOrdered field ref" },
    },
  },
}));

import { db } from "@/lib/db";
import { getOpenOrderProductIds } from "@/lib/open-order-lookup";

const findMany = (db.supplyOrderLine as unknown as { findMany: Mock }).findMany;
const QUANTITY_ORDERED_FIELD_REF = (
  db.supplyOrderLine as unknown as { fields: { quantityOrdered: unknown } }
).fields.quantityOrdered;

beforeEach(() => vi.clearAllMocks());

describe("getOpenOrderProductIds", () => {
  it("returns an empty set without querying when given no ids", async () => {
    const result = await getOpenOrderProductIds([]);
    expect(result).toEqual(new Set());
    expect(findMany).not.toHaveBeenCalled();
  });

  it("returns the set of product ids with a not-fully-received line on a non-RECEIVED order", async () => {
    findMany.mockResolvedValue([{ productId: "p1" }, { productId: "p3" }]);
    const result = await getOpenOrderProductIds(["p1", "p2", "p3"]);
    expect(result).toEqual(new Set(["p1", "p3"]));
    expect(findMany).toHaveBeenCalledWith({
      where: {
        productId: { in: ["p1", "p2", "p3"] },
        supplyOrder: { status: { not: "RECEIVED" } },
        quantityReceived: { lt: QUANTITY_ORDERED_FIELD_REF },
      },
      select: { productId: true },
    });
  });

  it("filters out a fully received line by comparing quantityReceived against quantityOrdered in the query", async () => {
    // The query itself is the thing under test here (db is mocked), so this
    // asserts the where-clause shape that excludes fully-received lines —
    // quantityReceived < quantityOrdered — rather than DB-level filtering.
    findMany.mockResolvedValue([]);
    await getOpenOrderProductIds(["p1"]);
    const call = findMany.mock.calls[0][0];
    expect(call.where.quantityReceived).toEqual({ lt: QUANTITY_ORDERED_FIELD_REF });
  });
});
