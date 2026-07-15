import type { Metadata } from "next";

import { db } from "@/lib/db";
import { getBackInStockProducts } from "@/lib/catalog";
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
    title: "Back In Stock",
    description:
      "Restocked records and tapes at Antenne Recordshop Tilburg — back on the shelf in the last 30 days.",
  };
}

export default async function BackInStockPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const genre = one(sp.genre);
  const condition = parseCondition(one(sp.condition));

  const genres = await db.genre.findMany({ orderBy: { name: "asc" } });
  const products = await getBackInStockProducts({
    genreId: resolveFilterId(genres, genre),
    condition,
  });

  return (
    <SectionPage
      heading="Back In Stock"
      active="back-in-stock"
      basePath="/stock/back-in-stock"
      genres={genres}
      params={{ genre, condition }}
      products={products}
    />
  );
}
