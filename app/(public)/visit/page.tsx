import type { Metadata } from "next";

import { Placeholder } from "@/components/ui/Placeholder";

export const metadata: Metadata = { title: "Visit" };

export default function VisitPage() {
  return (
    <Placeholder
      title="Visit & contact"
      description="Address, phone, opening hours (from the admin) and a map. Content coming soon."
    />
  );
}
