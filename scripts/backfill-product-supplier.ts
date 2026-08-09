// One-time migration for the supply-order redesign: every pre-existing
// product got `supplierId: null` when the column was added, so the "Order"
// quick-add button is disabled for all of them until a supplier is set. This
// backfills each product's supplier from its Label.supplierId, where one is
// set.
//
//   Run AFTER the add_supplier migration (Product.supplierId /
//   Label.supplierId) — see docs/features/order-transaction-redesign.md.
//
//   Run:  npx tsx scripts/backfill-product-supplier.ts
//
// Idempotent: only products with supplierId: null whose label has a
// supplierId set are selected, so already-backfilled products no longer
// match and re-running after a partial failure is safe.
import { PrismaClient } from "@prisma/client";

import { backfillProductSupplier } from "../lib/backfill-product-supplier";

const prisma = new PrismaClient();

async function main() {
  const result = await backfillProductSupplier({
    findProductsNeedingBackfill: async () => {
      const products = await prisma.product.findMany({
        where: { supplierId: null, label: { supplierId: { not: null } } },
        select: { id: true, label: { select: { supplierId: true } } },
      });
      return products.map((product) => ({
        id: product.id,
        labelSupplierId: product.label.supplierId!,
      }));
    },
    setProductSupplier: ({ productId, supplierId }) =>
      prisma.product.update({
        where: { id: productId },
        data: { supplierId },
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
