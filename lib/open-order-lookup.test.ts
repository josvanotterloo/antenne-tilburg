// @vitest-environment node
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

vi.mock("@/lib/db", () => ({ db: { supplyOrderLine: { findMany: vi.fn() } } }));

import { db } from "@/lib/db";
import { getOpenOrderProductIds } from "@/lib/open-order-lookup";

const findMany = (db.supplyOrderLine as unknown as { findMany: Mock }).findMany;

beforeEach(() => vi.clearAllMocks());

describe("getOpenOrderProductIds", () => {
  it("returns an empty set without querying when given no ids", async () => {
    const result = await getOpenOrderProductIds([]);
    expect(result).toEqual(new Set());
    expect(findMany).not.toHaveBeenCalled();
  });

  it("returns the set of product ids with a line on a non-RECEIVED order", async () => {
    findMany.mockResolvedValue([{ productId: "p1" }, { productId: "p3" }]);
    const result = await getOpenOrderProductIds(["p1", "p2", "p3"]);
    expect(result).toEqual(new Set(["p1", "p3"]));
    expect(findMany).toHaveBeenCalledWith({
      where: {
        productId: { in: ["p1", "p2", "p3"] },
        supplyOrder: { status: { not: "RECEIVED" } },
      },
      select: { productId: true },
    });
  });
});
