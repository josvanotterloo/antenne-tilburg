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

type GenreWithCount = {
  id: string;
  name: string;
  _count: { productGenres: number };
};

// Remapped to the shared { id, name, productCount } shape — ReferenceSection
// doesn't need to know Genre's relation is a join table (`productGenres`),
// not a direct FK count. Same pattern as artists/page.tsx's toArtistItems.
const toGenreItems = (rows: GenreWithCount[]): ReferenceItem[] =>
  rows.map((r) => ({
    id: r.id,
    name: r.name,
    productCount: r._count.productGenres,
  }));

export default async function GenresPage() {
  const session = await auth();
  const locale = session!.user.locale;
  const [genres, total] = await Promise.all([
    db.genre.findMany({
      orderBy: { name: "asc" },
      take: SEARCH_RESULT_CAP,
      include: { _count: { select: { productGenres: true } } },
    }),
    db.genre.count(),
  ]);

  return (
    <ReferenceSection
      title={t("reference.genres.title", locale)}
      addPlaceholder={t("reference.genres.addPlaceholder", locale)}
      endpoint="/api/admin/genres"
      initialItems={toGenreItems(genres)}
      initialTotal={total}
      productLinkParam="genreId"
      locale={locale}
    />
  );
}
