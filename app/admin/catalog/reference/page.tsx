import { db } from "@/lib/db";

import { ReferenceSection, type ReferenceItem } from "./ReferenceSection";

// Reads live reference data; never prerender at build time.
export const dynamic = "force-dynamic";

type WithCount = { id: string; name: string; _count: { products: number } };

const toItems = (rows: WithCount[]): ReferenceItem[] =>
  rows.map((r) => ({ id: r.id, name: r.name, productCount: r._count.products }));

const withCount = {
  orderBy: { name: "asc" as const },
  include: { _count: { select: { products: true } } },
};

export default async function ReferenceDataPage() {
  const [labels, genres, productTypes] = await Promise.all([
    db.label.findMany(withCount),
    db.genre.findMany(withCount),
    db.productType.findMany(withCount),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Reference data</h1>
        <p className="text-sm text-neutral-500">
          Labels, genres and product types used across the catalog.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <ReferenceSection
          title="Labels"
          endpoint="/api/admin/labels"
          initialItems={toItems(labels)}
        />
        <ReferenceSection
          title="Genres"
          endpoint="/api/admin/genres"
          initialItems={toItems(genres)}
        />
        <ReferenceSection
          title="Product Types"
          endpoint="/api/admin/product-types"
          initialItems={toItems(productTypes)}
        />
      </div>
    </div>
  );
}
