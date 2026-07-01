import type { Metadata } from "next";

import { Placeholder } from "@/components/ui/Placeholder";

export const metadata: Metadata = { title: "Blog" };

export default function BlogIndexPage() {
  return (
    <Placeholder
      title="Blog"
      description="New arrivals, events and restocks. Post index coming soon."
    />
  );
}
