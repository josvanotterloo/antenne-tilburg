import type { Metadata } from "next";

import { getThisWeekProducts } from "@/lib/catalog";
import { SectionPage } from "../SectionPage";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "This Week",
    description:
      "Records and tapes added to Antenne Recordshop Tilburg this week.",
  };
}

export default async function ThisWeekPage() {
  return <SectionPage heading="This Week" active="this-week" products={await getThisWeekProducts()} />;
}
