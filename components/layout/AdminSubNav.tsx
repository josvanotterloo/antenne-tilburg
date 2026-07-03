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
    <nav className="mb-6 flex gap-4 border-b border-neutral-200 text-sm">
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
                ? "border-neutral-900 font-medium"
                : "border-transparent text-neutral-500 hover:text-neutral-900"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
