import { db } from "@/lib/db";
import { ReferenceSection } from "@/components/admin/ReferenceSection";
import {
  SEARCH_RESULT_CAP,
  toSimpleReferenceItems,
} from "@/lib/reference-items";

// Reads live reference data; never prerender at build time.
export const dynamic = "force-dynamic";

export default async function ProductTypesPage() {
  const [productTypes, total] = await Promise.all([
    db.productType.findMany({
      orderBy: { name: "asc" },
      take: SEARCH_RESULT_CAP,
      include: { _count: { select: { products: true } } },
    }),
    db.productType.count(),
  ]);

  return (
    <ReferenceSection
      title="Product Types"
      endpoint="/api/admin/product-types"
      initialItems={toSimpleReferenceItems(productTypes)}
      initialTotal={total}
    />
  );
}
