// lib/backfill-stock-opening-balance.ts
// One-time migration: give every pre-existing product with stock an opening
// ADJUSTMENT transaction, so the ledger invariant (sum of transactions ==
// Product.quantity) holds from day one. quantity === 0 products are skipped —
// a 0-quantity ledger entry is meaningless (see lib/stock.ts's own "no
// transaction at zero" rule). Idempotent: the caller's finder query excludes
// products that already have any transaction.

export interface ProductNeedingBackfill {
  id: string;
  quantity: number;
}

export interface BackfillStockDeps {
  findProductsNeedingBackfill: () => Promise<ProductNeedingBackfill[]>;
  createOpeningTransaction: (args: { productId: string; quantity: number }) => Promise<unknown>;
}

export async function backfillStockOpeningBalance(
  deps: BackfillStockDeps,
): Promise<{ productsBackfilled: number }> {
  const products = await deps.findProductsNeedingBackfill();
  for (const product of products) {
    await deps.createOpeningTransaction({ productId: product.id, quantity: product.quantity });
  }
  return { productsBackfilled: products.length };
}
