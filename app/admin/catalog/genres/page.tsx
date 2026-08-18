import { db } from "@/lib/db";
import {
  ReferenceSection,
  SEARCH_RESULT_CAP,
  toSimpleReferenceItems,
} from "@/components/admin/ReferenceSection";

// Reads live reference data; never prerender at build time.
export const dynamic = "force-dynamic";

export default async function GenresPage() {
  const [genres, total] = await Promise.all([
    db.genre.findMany({
      orderBy: { name: "asc" },
      take: SEARCH_RESULT_CAP,
      include: { _count: { select: { products: true } } },
    }),
    db.genre.count(),
  ]);

  return (
    <ReferenceSection
      title="Genres"
      endpoint="/api/admin/genres"
      initialItems={toSimpleReferenceItems(genres)}
      initialTotal={total}
    />
  );
}
