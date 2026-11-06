import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { t } from "@/lib/i18n/t";
import {
  ReferenceSection,
  type ReferenceItem,
} from "@/components/admin/ReferenceSection";
import { SEARCH_RESULT_CAP } from "@/lib/reference-items";

// Reads live reference data; never prerender at build time.
export const dynamic = "force-dynamic";

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
  const session = await auth();
  const locale = session!.user.locale;
  const [artists, total] = await Promise.all([
    db.artist.findMany({
      orderBy: { name: "asc" },
      take: SEARCH_RESULT_CAP,
      include: { _count: { select: { productArtists: true } } },
    }),
    db.artist.count(),
  ]);

  return (
    <ReferenceSection
      title={t("reference.artists.title", locale)}
      addPlaceholder={t("reference.artists.addPlaceholder", locale)}
      countSingular={t("reference.artists.countSingular", locale)}
      endpoint="/api/admin/artists"
      initialItems={toArtistItems(artists)}
      initialTotal={total}
      productLinkParam="artistId"
      locale={locale}
    />
  );
}
