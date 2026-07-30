// lib/backfill-stock-opening-balance.test.ts
import { describe, it, expect, vi } from "vitest";

import { backfillStockOpeningBalance } from "@/lib/backfill-stock-opening-balance";

describe("backfillStockOpeningBalance", () => {
  it("creates one ADJUSTMENT transaction per product with quantity > 0 and no existing transactions", async () => {
    const create = vi.fn().mockResolvedValue({ id: "t1" });
    const result = await backfillStockOpeningBalance({
      findProductsNeedingBackfill: () =>
        Promise.resolve([
          { id: "p1", quantity: 5 },
          { id: "p2", quantity: 2 },
        ]),
      createOpeningTransaction: create,
    });
    expect(result).toEqual({ productsBackfilled: 2 });
    expect(create).toHaveBeenCalledWith({ productId: "p1", quantity: 5 });
    expect(create).toHaveBeenCalledWith({ productId: "p2", quantity: 2 });
  });

  it("does nothing when there are no products to backfill", async () => {
    const create = vi.fn();
    const result = await backfillStockOpeningBalance({
      findProductsNeedingBackfill: () => Promise.resolve([]),
      createOpeningTransaction: create,
    });
    expect(result).toEqual({ productsBackfilled: 0 });
    expect(create).not.toHaveBeenCalled();
  });
});
