import type { Metadata } from "next";

import { db } from "@/lib/db";
import { getThisWeekProducts } from "@/lib/catalog";
import {
  one,
  parseCondition,
  resolveFilterId,
  type SearchParams,
} from "@/components/stock/StockFilters";
import { SectionPage } from "../SectionPage";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "This Week",
    description:
      "Records and tapes added to Antenne Recordshop Tilburg this week.",
  };
}

export default async function ThisWeekPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const genre = one(sp.genre);
  const condition = parseCondition(one(sp.condition));

  const genres = await db.genre.findMany({ orderBy: { name: "asc" } });
  const products = await getThisWeekProducts({
    genreId: resolveFilterId(genres, genre),
    condition,
  });

  return (
    <SectionPage
      heading="This Week"
      active="this-week"
      basePath="/stock/this-week"
      genres={genres}
      params={{ genre, condition }}
      products={products}
    />
  );
}
