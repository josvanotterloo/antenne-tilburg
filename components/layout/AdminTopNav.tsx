"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

// Top-level admin sections. `match` decides the active state by path prefix so
// deeper routes (e.g. /admin/catalog/new) still highlight their section.
const SECTIONS = [
  { label: "Catalog", href: "/admin/catalog", match: "/admin/catalog" },
  { label: "Content", href: "/admin/content/posts", match: "/admin/content" },
  { label: "Settings", href: "/admin/settings/hours", match: "/admin/settings" },
];

export function AdminTopNav() {
  const pathname = usePathname();

  // The login page shares the /admin layout but has no chrome (and no session
  // to sign out of).
  if (pathname === "/admin/login") return null;

  return (
    <header className="bg-[#1a1a1a] text-white">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4">
        <Link href="/admin/catalog" className="font-bold tracking-tight">
          Antenne Tilburg
        </Link>

        <nav className="flex items-center gap-1">
          {SECTIONS.map((section) => {
            const active = pathname.startsWith(section.match);
            return (
              <Link
                key={section.href}
                href={section.href}
                aria-current={active ? "page" : undefined}
                className={`rounded px-3 py-1.5 text-sm ${
                  active
                    ? "bg-white/15 text-white"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                {section.label}
              </Link>
            );
          })}
        </nav>

        <button
          type="button"
          onClick={() => signOut({ redirectTo: "/admin/login" })}
          className="ml-auto rounded px-3 py-1.5 text-sm text-neutral-400 hover:text-white"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}
