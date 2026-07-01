import type { Metadata } from "next";

import { Placeholder } from "@/components/ui/Placeholder";

export const metadata: Metadata = { title: "About" };

export default function AboutPage() {
  return (
    <Placeholder
      title="About"
      description="Shop story, genre focus, the second-hand section, and who runs it. Content coming soon."
    />
  );
}
