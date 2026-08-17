import { db } from "@/lib/db";

import { ReferenceSection, type ReferenceItem } from "./ReferenceSection";

const PAGE_SIZE = 20;

type WithCount = { id: string; name: string; _count: { products: number } };

const toItems = (rows: WithCount[]): ReferenceItem[] =>
  rows.map((r) => ({ id: r.id, name: r.name, productCount: r._count.products }));

type LabelWithCount = WithCount & { supplier: { id: string; name: string } | null };

const toLabelItems = (rows: LabelWithCount[]): ReferenceItem[] =>
  rows.map((r) => ({
    id: r.id,
    name: r.name,
    productCount: r._count.products,
    supplierId: r.supplier?.id ?? null,
    supplierName: r.supplier?.name ?? null,
  }));

// First page only — these tables can hold tens of thousands of rows
// (55k+ artists in production), so an unbounded findMany here would defeat
// the point of the typeahead search this page hands off to on the client.
const firstPage = {
  orderBy: { name: "asc" as const },
  take: PAGE_SIZE,
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

export type FocusSection = "labels" | "artists" | "genres" | "product-types";

// Shared by the bare /admin/catalog/reference page and its four per-section
// routes (labels/artists/genres/product-types) — same grid of all four
// sections either way, just with the section matching `focusSection`
// auto-focused/scrolled to on load. Kept as one view because an admin
// editing a Label often wants the Suppliers cross-reference alongside it.
export async function ReferenceDataView({
  focusSection,
}: {
  focusSection?: FocusSection;
} = {}) {
  const [
    labels,
    labelTotal,
    genres,
    genreTotal,
    productTypes,
    productTypeTotal,
    artists,
    artistTotal,
  ] = await Promise.all([
    db.label.findMany({ ...firstPage, include: { ...firstPage.include, supplier: true } }),
    db.label.count(),
    db.genre.findMany(firstPage),
    db.genre.count(),
    db.productType.findMany(firstPage),
    db.productType.count(),
    db.artist.findMany({
      orderBy: { name: "asc" },
      take: PAGE_SIZE,
      include: { _count: { select: { productArtists: true } } },
    }),
    db.artist.count(),
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
          initialItems={toLabelItems(labels)}
          initialTotal={labelTotal}
          supplierEndpoint="/api/admin/suppliers"
          focused={focusSection === "labels"}
        />
        <ReferenceSection
          title="Genres"
          endpoint="/api/admin/genres"
          initialItems={toItems(genres)}
          initialTotal={genreTotal}
          focused={focusSection === "genres"}
        />
        <ReferenceSection
          title="Product Types"
          endpoint="/api/admin/product-types"
          initialItems={toItems(productTypes)}
          initialTotal={productTypeTotal}
          focused={focusSection === "product-types"}
        />
        <ReferenceSection
          title="Artists"
          endpoint="/api/admin/artists"
          initialItems={toArtistItems(artists)}
          initialTotal={artistTotal}
          focused={focusSection === "artists"}
        />
      </div>
    </div>
  );
}
