// scripts/backfill-stock-opening-balance.ts
//
//   Run AFTER the add_stock_management migration (Task 1) — see
//   docs/features/stock-management.md.
//
//   Run:  npx tsx scripts/backfill-stock-opening-balance.ts
//
// Idempotent: products that already have a StockTransaction are skipped by
// the query itself, so re-running after a partial failure is safe.
import { PrismaClient } from "@prisma/client";

import { backfillStockOpeningBalance } from "../lib/backfill-stock-opening-balance";

const prisma = new PrismaClient();

async function main() {
  const result = await backfillStockOpeningBalance({
    findProductsNeedingBackfill: () =>
      prisma.product.findMany({
        where: { quantity: { gt: 0 }, transactions: { none: {} } },
        select: { id: true, quantity: true },
      }),
    createOpeningTransaction: ({ productId, quantity }) =>
      prisma.stockTransaction.create({
        data: { productId, type: "ADJUSTMENT", quantity, note: "Opening balance" },
      }),
  });
  console.log(`Done: ${result.productsBackfilled} product(s) backfilled.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
