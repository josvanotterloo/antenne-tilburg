// One-time backfill core for the supply-order redesign: every pre-existing
// Product got `supplierId: null` when the column was added, which disables
// the "Order" quick-add button until a supplier is set. The label→product
// supplier prefill only fires when creating a *new* product, so it never
// touches existing catalog rows. This copies each product's supplier from
// its Label.supplierId where one is set. Pure over injected deps so it is
// unit-testable; the runnable wrapper is scripts/backfill-product-supplier.ts.
// Idempotent: findProductsNeedingBackfill only returns products with
// supplierId: null whose label has a supplierId set, so a product already
// backfilled (or with no eligible source) no longer matches and re-running
// after a partial run is safe.

export interface ProductNeedingSupplierBackfill {
  id: string;
  labelSupplierId: string;
}

export interface BackfillProductSupplierDeps {
  findProductsNeedingBackfill: () => Promise<ProductNeedingSupplierBackfill[]>;
  setProductSupplier: (args: { productId: string; supplierId: string }) => Promise<unknown>;
}

export async function backfillProductSupplier(
  deps: BackfillProductSupplierDeps,
): Promise<{ productsBackfilled: number }> {
  const products = await deps.findProductsNeedingBackfill();
  for (const product of products) {
    await deps.setProductSupplier({ productId: product.id, supplierId: product.labelSupplierId });
  }
  return { productsBackfilled: products.length };
}
