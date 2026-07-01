import Link from "next/link";

const NAV = [
  { href: "/", label: "Home" },
  { href: "/stock", label: "Stock" },
  { href: "/blog", label: "Blog" },
  { href: "/events", label: "Events" },
  { href: "/visit", label: "Visit" },
];

export function SiteHeader() {
  return (
    <header className="border-b border-neutral-200">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
        <Link href="/" className="text-lg font-bold tracking-tight">
          Antenne <span className="text-neutral-400">Tilburg</span>
        </Link>
        <nav className="flex gap-4 text-sm">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-neutral-600 hover:text-neutral-900"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
