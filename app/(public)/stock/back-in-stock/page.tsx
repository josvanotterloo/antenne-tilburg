import type { Metadata } from "next";

import { getBackInStockProducts } from "@/lib/catalog";
import { SectionPage } from "../SectionPage";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Back In Stock",
    description:
      "Restocked records and tapes at Antenne Recordshop Tilburg — back on the shelf in the last 30 days.",
  };
}

export default async function BackInStockPage() {
  return (
    <SectionPage
      heading="Back In Stock"
      active="back-in-stock"
      products={await getBackInStockProducts()}
    />
  );
}
