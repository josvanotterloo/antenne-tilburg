"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Sub-navigation for an admin section (Content, Settings, Catalog). Reused
// across section layouts; highlights the active item by path prefix, unless
// the item is marked `exact` — needed when one item's href is itself a
// prefix of a sibling's href (e.g. Catalog's "/admin/catalog" root item vs.
// its "/admin/catalog/orders" sibling), so only one item is ever active.
export function AdminSubNav({
  items,
}: {
  items: { href: string; label: string; exact?: boolean }[];
}) {
  const pathname = usePathname();
  return (
    <nav className="mb-6 flex gap-4 border-b border-admin-hairline text-sm">
      {items.map((item) => {
        const active = item.exact
          ? pathname === item.href
          : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`-mb-px border-b-2 pb-2 ${
              active
                ? "border-admin-ink font-medium"
                : "border-transparent text-admin-ink-muted hover:text-admin-ink"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
