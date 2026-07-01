import type { Metadata } from "next";

import { Placeholder } from "@/components/ui/Placeholder";

export const metadata: Metadata = { title: "Events" };

export default function EventsIndexPage() {
  return (
    <Placeholder
      title="Events"
      description="Upcoming and past events at Antenne / Sam-Sam. Listing coming soon."
    />
  );
}
