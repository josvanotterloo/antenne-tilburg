import type { Metadata } from "next";

import { Placeholder } from "@/components/ui/Placeholder";

export const metadata: Metadata = { title: "Stock" };

export default function StockPage() {
  return (
    <Placeholder
      title="Stock"
      description="Browsable, filterable listing by genre, label, product type, condition and Just In. Listing coming soon."
    />
  );
}
