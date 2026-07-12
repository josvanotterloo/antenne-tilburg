"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", label: "Home" },
  { href: "/stock", label: "Stock" },
  { href: "/blog", label: "Blog" },
  { href: "/visit", label: "Visit" },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function SiteHeader() {
  const pathname = usePathname() ?? "/";

  return (
    <header className="border-b border-hairline bg-canvas">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-4">
        <Link href="/" className="inline-flex items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt="Antenne Tilburg"
            className="h-14 w-auto opacity-90 invert transition-opacity duration-150 ease-out mix-blend-screen hover:opacity-100"
          />
        </Link>
        <nav className="flex flex-wrap gap-x-5 gap-y-2 font-mono text-xs font-medium uppercase tracking-[0.06em]">
          {NAV.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={
                  active
                    ? "border-b border-signal pb-1 text-ink"
                    : "pb-1 text-ink-muted transition-colors duration-150 ease-out hover:text-ink"
                }
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
