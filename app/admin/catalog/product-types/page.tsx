import { db } from "@/lib/db";
import { ReferenceSection, type ReferenceItem } from "@/components/admin/ReferenceSection";

// Reads live reference data; never prerender at build time.
export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

type WithCount = { id: string; name: string; _count: { products: number } };

const toItems = (rows: WithCount[]): ReferenceItem[] =>
  rows.map((r) => ({ id: r.id, name: r.name, productCount: r._count.products }));

export default async function ProductTypesPage() {
  const [productTypes, total] = await Promise.all([
    db.productType.findMany({
      orderBy: { name: "asc" },
      take: PAGE_SIZE,
      include: { _count: { select: { products: true } } },
    }),
    db.productType.count(),
  ]);

  return (
    <ReferenceSection
      title="Product Types"
      endpoint="/api/admin/product-types"
      initialItems={toItems(productTypes)}
      initialTotal={total}
    />
  );
}
