import { db } from "@/lib/db";
import { ReferenceSection, type ReferenceItem } from "@/components/admin/ReferenceSection";

// Reads live reference data; never prerender at build time.
export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

type WithCount = { id: string; name: string; _count: { products: number } };

const toItems = (rows: WithCount[]): ReferenceItem[] =>
  rows.map((r) => ({ id: r.id, name: r.name, productCount: r._count.products }));

export default async function GenresPage() {
  const [genres, total] = await Promise.all([
    db.genre.findMany({
      orderBy: { name: "asc" },
      take: PAGE_SIZE,
      include: { _count: { select: { products: true } } },
    }),
    db.genre.count(),
  ]);

  return (
    <ReferenceSection
      title="Genres"
      endpoint="/api/admin/genres"
      initialItems={toItems(genres)}
      initialTotal={total}
    />
  );
}
