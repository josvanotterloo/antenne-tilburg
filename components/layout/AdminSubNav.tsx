"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Sub-navigation for an admin section (Content, Settings). Reused across
// section layouts; highlights the active item by path prefix.
export function AdminSubNav({
  items,
}: {
  items: { href: string; label: string }[];
}) {
  const pathname = usePathname();
  return (
    <nav className="mb-6 flex gap-4 border-b border-admin-hairline text-sm">
      {items.map((item) => {
        const active =
          pathname === item.href || pathname.startsWith(`${item.href}/`);
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
