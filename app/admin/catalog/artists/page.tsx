import { db } from "@/lib/db";
import { ReferenceSection, type ReferenceItem } from "@/components/admin/ReferenceSection";

// Reads live reference data; never prerender at build time.
export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

type ArtistWithCount = {
  id: string;
  name: string;
  _count: { productArtists: number };
};

// Remapped to the shared { id, name, productCount } shape — ReferenceSection
// doesn't need to know Artist's relation is a join table (`productArtists`),
// not a direct FK count.
const toArtistItems = (rows: ArtistWithCount[]): ReferenceItem[] =>
  rows.map((r) => ({
    id: r.id,
    name: r.name,
    productCount: r._count.productArtists,
  }));

export default async function ArtistsPage() {
  const [artists, total] = await Promise.all([
    db.artist.findMany({
      orderBy: { name: "asc" },
      take: PAGE_SIZE,
      include: { _count: { select: { productArtists: true } } },
    }),
    db.artist.count(),
  ]);

  return (
    <ReferenceSection
      title="Artists"
      endpoint="/api/admin/artists"
      initialItems={toArtistItems(artists)}
      initialTotal={total}
    />
  );
}
