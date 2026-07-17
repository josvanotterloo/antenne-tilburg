import Link from "next/link";
import { SHOP } from "@/lib/shop-info";

import NewsletterForm from "@/components/NewsletterForm";
import SocialLinks from "@/components/SocialLinks";

const NAV = [
  { href: "/stock", label: "Stock" },
  { href: "/blog", label: "Blog" },
  { href: "/visit", label: "Visit" },
  { href: "/about", label: "About" },
  { href: "/faq", label: "FAQ" },
];

const heading =
  "font-mono text-xs font-medium uppercase tracking-[0.06em] text-ink-muted";
const link =
  "font-mono text-sm text-ink-muted transition-colors duration-150 ease-out hover:text-signal";

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-hairline bg-canvas">
      <div className="mx-auto grid max-w-5xl gap-10 px-4 py-12 md:grid-cols-3">
        {/* FOLLOW */}
        <div className="space-y-6">
          <h2 className={heading}>Follow</h2>
          <NewsletterForm />
          <div className="space-y-3">
            <p className={heading}>Follow us</p>
            <SocialLinks />
          </div>
        </div>

        {/* NAVIGATE */}
        <nav aria-label="Footer navigation" className="space-y-4">
          <h2 className={heading}>Navigate</h2>
          <ul className="space-y-2">
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
          <h2 className={heading}>Contact</h2>
          <address className="space-y-1 font-mono text-sm not-italic text-ink-muted">
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
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-2 px-4 py-4 font-mono text-xs text-ink-muted sm:flex-row">
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
