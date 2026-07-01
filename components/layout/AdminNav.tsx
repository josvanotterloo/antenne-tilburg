"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

const SECTIONS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/labels", label: "Labels" },
  { href: "/admin/genres", label: "Genres" },
  { href: "/admin/product-types", label: "Product types" },
  { href: "/admin/posts", label: "Blog posts" },
  { href: "/admin/events", label: "Events" },
  { href: "/admin/notices", label: "Notices" },
  { href: "/admin/opening-hours", label: "Opening hours" },
  { href: "/admin/subscribers", label: "Subscribers" },
  { href: "/admin/want-list", label: "Want list" },
  { href: "/admin/users", label: "Users" },
];

export function AdminNav() {
  const pathname = usePathname();

  // The login page shares the admin route segment but has no chrome.
  if (pathname === "/admin/login") return null;

  return (
    <aside className="w-56 shrink-0 border-r border-neutral-200 bg-neutral-50">
      <div className="p-4">
        <Link href="/admin" className="font-bold">
          Antenne Admin
        </Link>
      </div>
      <nav className="flex flex-col gap-0.5 px-2 pb-4 text-sm">
        {SECTIONS.map((section) => {
          const active =
            pathname === section.href ||
            (section.href !== "/admin" && pathname.startsWith(section.href));
          return (
            <Link
              key={section.href}
              href={section.href}
              className={`rounded px-2 py-1.5 ${
                active
                  ? "bg-neutral-900 text-white"
                  : "text-neutral-600 hover:bg-neutral-200"
              }`}
            >
              {section.label}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/admin/login" })}
          className="mt-4 rounded px-2 py-1.5 text-left text-neutral-600 hover:bg-neutral-200"
        >
          Sign out
        </button>
      </nav>
    </aside>
  );
}
