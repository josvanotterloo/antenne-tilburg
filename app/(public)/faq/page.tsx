import type { Metadata } from "next";

import { Placeholder } from "@/components/ui/Placeholder";

export const metadata: Metadata = { title: "FAQ" };

export default function FaqPage() {
  return (
    <Placeholder
      title="FAQ"
      description="Vinyl & tape only, the second-hand section, Discogs vs. in-store stock, and the pickup process. Content coming soon."
    />
  );
}
