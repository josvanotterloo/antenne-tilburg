import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "FAQ",
  description:
    "Common questions about Antenne Recordshop — vinyl and tape only, the second-hand section, how Discogs stock differs from the in-store racks, and the next-day pickup process.",
};

// Q&A source of truth. Rendered as visible content AND as FAQPage structured data,
// so the answers are crawlable and eligible for rich results.
const FAQ_ITEMS: { q: string; a: string }[] = [
  {
    q: "Do you sell only vinyl and tapes?",
    a: "Yes — Antenne is vinyl and tape only. Mostly new vinyl, some tapes, plus a second-hand section. No CDs.",
  },
  {
    q: "What's in the second-hand section?",
    a: "It leans electronic but wanders well beyond it — dance, funk, soul, jazz, rock and pop all turn up. Everything is graded honestly and priced to move.",
  },
  {
    q: "Is your Discogs stock the same as what's in the shop?",
    a: "No. The Discogs stock is kept completely separate from the shop floor. What's listed online isn't what's in the in-store racks, and vice versa.",
  },
  {
    q: "Do you ship Discogs orders?",
    a: "Discogs orders aren't shipped from the shop. They're prepared for next-day pickup at Antenne, inside Sam-Sam vintage.",
  },
  {
    q: "Can you hold or reserve a record for me?",
    a: "In the shop it's first come, first served — we generally don't hold copies. If you want something guaranteed, buy it on Discogs and pick it up the next day.",
  },
  {
    q: "Where are you, and when are you open?",
    a: "Inside Sam-Sam vintage at Noordstraat 82, Tilburg. Opening hours are on the Visit page, along with a map.",
  },
];

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ_ITEMS.map((item) => ({
    "@type": "Question",
    name: item.q,
    acceptedAnswer: { "@type": "Answer", text: item.a },
  })),
};

export default function FaqPage() {
  return (
    <div className="mx-auto max-w-prose space-y-8">
      <script
        type="application/ld+json"
        // Static, developer-authored content — no user input in this JSON.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">
          FAQ
        </h1>
        <p className="max-w-prose text-ink-muted">
          The questions we get asked most. Still stuck? Ask us in the shop.
        </p>
      </header>

      <dl className="divide-y divide-hairline border-t border-hairline">
        {FAQ_ITEMS.map((item) => (
          <div key={item.q} className="space-y-2 py-6">
            <dt className="text-lg font-semibold tracking-tight text-ink">
              {item.q}
            </dt>
            <dd className="text-pretty leading-relaxed text-ink-muted">
              {item.a}
            </dd>
          </div>
        ))}
      </dl>

      <p className="text-ink-muted">
        Opening hours and a map are on the{" "}
        <Link
          href="/visit"
          className="text-ink underline decoration-hairline underline-offset-4 transition-colors hover:text-signal hover:decoration-signal"
        >
          Visit page
        </Link>
        .
      </p>
    </div>
  );
}
