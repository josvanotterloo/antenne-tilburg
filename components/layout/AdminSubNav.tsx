"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Sub-navigation for an admin section (Content, Settings, Catalog). Reused
// across section layouts. A section's root item (e.g. "/admin/catalog") is
// itself a prefix of any sibling's href (e.g. "/admin/catalog/orders") and
// of any unlisted sub-path (e.g. "/admin/catalog/[id]/edit") — matching each
// item independently would either highlight the root AND a sibling at once,
// or (if the root is excluded from prefix matching) highlight nothing on an
// unlisted sub-path. Picking the single LONGEST matching href across all
// items solves both: a sibling's more specific href always wins over the
// root's, and the root still catches anything no sibling claims.
export function AdminSubNav({
  items,
}: {
  items: { href: string; label: string }[];
}) {
  const pathname = usePathname();
  const matches = items.filter(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
  const active = matches.reduce<{ href: string; label: string } | null>(
    (best, item) => (!best || item.href.length > best.href.length ? item : best),
    null,
  );

  return (
    <nav className="mb-6 flex gap-4 border-b border-admin-hairline text-sm">
      {items.map((item) => {
        const isActive = item === active;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={`-mb-px border-b-2 pb-2 ${
              isActive
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
