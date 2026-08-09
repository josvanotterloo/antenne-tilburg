// lib/backfill-product-supplier.test.ts
import { describe, it, expect, vi } from "vitest";

import { backfillProductSupplier } from "@/lib/backfill-product-supplier";

describe("backfillProductSupplier", () => {
  it("sets the supplier on every product returned by the finder and returns the count", async () => {
    const setProductSupplier = vi.fn().mockResolvedValue({ id: "p1" });
    const result = await backfillProductSupplier({
      findProductsNeedingBackfill: () =>
        Promise.resolve([
          { id: "p1", labelSupplierId: "s1" },
          { id: "p2", labelSupplierId: "s2" },
        ]),
      setProductSupplier,
    });
    expect(result).toEqual({ productsBackfilled: 2 });
    expect(setProductSupplier).toHaveBeenCalledWith({ productId: "p1", supplierId: "s1" });
    expect(setProductSupplier).toHaveBeenCalledWith({ productId: "p2", supplierId: "s2" });
  });

  it("does nothing when there are no products to backfill", async () => {
    const setProductSupplier = vi.fn();
    const result = await backfillProductSupplier({
      findProductsNeedingBackfill: () => Promise.resolve([]),
      setProductSupplier,
    });
    expect(result).toEqual({ productsBackfilled: 0 });
    expect(setProductSupplier).not.toHaveBeenCalled();
  });
});
