import { db } from "@/lib/db";

// Product ids that already have a line on a non-RECEIVED SupplyOrder — lets
// the catalog list and transactions page compute each row's "Order"/"Ordered"
// button state with one query per page instead of one per row.
export async function getOpenOrderProductIds(productIds: string[]): Promise<Set<string>> {
  if (productIds.length === 0) return new Set();
  const lines = await db.supplyOrderLine.findMany({
    where: {
      productId: { in: productIds },
      supplyOrder: { status: { not: "RECEIVED" } },
    },
    select: { productId: true },
  });
  return new Set(lines.map((l) => l.productId));
}
