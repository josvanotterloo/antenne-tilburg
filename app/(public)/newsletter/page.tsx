import type { Metadata } from "next";

import NewsletterForm from "@/components/NewsletterForm";

export const metadata: Metadata = {
  title: "Newsletter",
  description:
    "Sign up for the Antenne Recordshop newsletter — new arrivals, restocks and shop news, straight to your inbox.",
};

export default function NewsletterPage() {
  return (
    <div className="mx-auto max-w-prose space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">
          Newsletter
        </h1>
        <p className="max-w-prose text-ink-muted">
          The occasional signal — new arrivals, restocks and shop news. No spam,
          just records. Leave your name and email and we&rsquo;ll keep you in the
          loop.
        </p>
      </header>

      <NewsletterForm />
    </div>
  );
}
