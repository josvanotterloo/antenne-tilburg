import type { Metadata } from "next";

import { getLastWeekProducts } from "@/lib/catalog";
import { SectionPage } from "../SectionPage";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Last Week",
    description:
      "Records and tapes added to Antenne Recordshop Tilburg last week.",
  };
}

export default async function LastWeekPage() {
  return <SectionPage heading="Last Week" active="last-week" products={await getLastWeekProducts()} />;
}
