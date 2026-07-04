import type { Metadata } from "next";

import NewsletterForm from "@/components/NewsletterForm";
import SocialLinks from "@/components/SocialLinks";

export const metadata: Metadata = {
  title: "Newsletter",
  description:
    "Stay connected with Antenne Recordshop — sign up for the newsletter (new arrivals, restocks, shop news) and follow us on Facebook, Instagram and SoundCloud.",
};

const label =
  "font-mono text-xs font-medium uppercase tracking-[0.04em] text-ink-muted";

export default function NewsletterPage() {
  return (
    <div className="mx-auto max-w-prose space-y-10">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">
          Stay Connected
        </h1>
        <p className="max-w-prose text-ink-muted">
          Two ways to keep the signal: the newsletter for new arrivals and shop
          news, or follow along on socials.
        </p>
      </header>

      <section className="space-y-4">
        <h2 className={label}>Newsletter</h2>
        <p className="max-w-prose text-ink-muted">
          The occasional signal — new arrivals, restocks and shop news. No spam,
          just records. Leave your name and email and we&rsquo;ll keep you in the
          loop.
        </p>
        <NewsletterForm />
      </section>

      <section className="space-y-4 border-t border-hairline pt-8">
        <h2 className={label}>Follow us</h2>
        <SocialLinks />
      </section>
    </div>
  );
}
