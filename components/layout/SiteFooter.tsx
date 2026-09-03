import Link from "next/link";
import { SHOP } from "@/lib/shop-info";

import NewsletterForm from "@/components/NewsletterForm";
import SocialLinks from "@/components/SocialLinks";

const NAV = [
  { href: "/stock", label: "New Arrivals" },
  { href: "/blog", label: "Blog" },
  { href: "/visit", label: "Visit" },
  { href: "/about", label: "About" },
  { href: "/faq", label: "FAQ" },
];

const heading =
  "font-mono text-xs font-medium uppercase tracking-[0.06em] text-ink-muted";
// The three top-level column titles (Follow/Navigate/Contact) read as
// labels, not headings — small, wide-tracked, with generous room below
// the hairline before their content starts (the plain `heading` style
// above stays as-is for in-column sub-labels like "Follow us").
const columnHeading =
  "border-b border-hairline pb-2 mb-5 font-mono text-[0.6875rem] font-bold uppercase tracking-[0.1em] text-ink-muted";
const link =
  "font-mono text-sm leading-loose text-ink-muted transition-colors duration-150 ease-out hover:text-signal";

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-hairline bg-canvas">
      <div className="mx-auto grid max-w-5xl gap-10 px-4 py-16 md:grid-cols-3">
        {/* FOLLOW */}
        <div className="space-y-6">
          <h2 className={columnHeading}>Follow</h2>
          <NewsletterForm variant="email-only" />
          <div className="space-y-3">
            <p className={heading}>Follow us</p>
            <SocialLinks />
          </div>
        </div>

        {/* NAVIGATE */}
        <nav aria-label="Footer navigation" className="space-y-4">
          <h2 className={columnHeading}>Navigate</h2>
          <ul className="space-y-3">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className={link}>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* CONTACT */}
        <div className="space-y-4">
          <h2 className={columnHeading}>Contact</h2>
          <address className="space-y-2 font-mono text-sm leading-relaxed not-italic text-ink-muted">
            <p className="text-ink">{SHOP.name}</p>
            <p>{SHOP.addressLine}</p>
            <p>{SHOP.addressNote}</p>
            <p>
              <a
                href={SHOP.phoneHref}
                className="transition-colors duration-150 ease-out hover:text-signal"
              >
                {SHOP.phone}
              </a>
            </p>
          </address>
          <Link href="/visit" className={link}>
            See full opening hours →
          </Link>
        </div>
      </div>

      <div className="border-t border-hairline">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-2 px-4 py-6 font-mono text-[0.6875rem] text-ink-muted/80 sm:flex-row">
          <span>© {new Date().getFullYear()} Antenne Recordshop</span>
          <a
            href="https://www.discogs.com/seller/antennetilburg"
            target="_blank"
            rel="noopener noreferrer"
            className="uppercase tracking-[0.06em] transition-colors duration-150 ease-out hover:text-signal"
          >
            Also on Discogs ↗
          </a>
        </div>
      </div>
    </footer>
  );
}
