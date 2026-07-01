import type { Metadata } from "next";

import { Placeholder } from "@/components/ui/Placeholder";

export const metadata: Metadata = { title: "Newsletter" };

export default function NewsletterPage() {
  return (
    <Placeholder
      title="Newsletter"
      description="Sign up with your name and email for new arrivals and events. Form coming soon."
    />
  );
}
