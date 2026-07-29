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

type ArtistWithCount = {
  id: string;
  name: string;
  _count: { productArtists: number };
};

// Remapped to the same { id, name, productCount } shape as the other lists
// here — ReferenceSection doesn't need to know Artist's relation is a join
// table (`productArtists`), not a direct FK count (`products`).
const toArtistItems = (rows: ArtistWithCount[]): ReferenceItem[] =>
  rows.map((r) => ({
    id: r.id,
    name: r.name,
    productCount: r._count.productArtists,
  }));

export default async function ReferenceDataPage() {
  const [labels, genres, productTypes, artists] = await Promise.all([
    db.label.findMany(withCount),
    db.genre.findMany(withCount),
    db.productType.findMany(withCount),
    db.artist.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { productArtists: true } } },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Reference data</h1>
        <p className="text-sm text-admin-ink-muted">
          Labels, genres, product types and artists used across the catalog.
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
        <ReferenceSection
          title="Artists"
          endpoint="/api/admin/artists"
          initialItems={toArtistItems(artists)}
        />
      </div>
    </div>
  );
}
