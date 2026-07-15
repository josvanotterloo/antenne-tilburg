import Link from "next/link";

const SECTIONS = [
  { key: "all", label: "All Stock", href: "/stock" },
  { key: "this-week", label: "This Week", href: "/stock/this-week" },
  { key: "last-week", label: "Last Week", href: "/stock/last-week" },
  { key: "back-in-stock", label: "Back In Stock", href: "/stock/back-in-stock" },
] as const;

export type StockSection = (typeof SECTIONS)[number]["key"];

// Persistent navigation across the stock surfaces. The active section gets
// the signal underline (DESIGN.md nav rule); the optional child is the
// search form — /stock only, since the section pages don't filter. On small
// screens the search wraps onto its own row below the links.
export function StockNav({
  active,
  children,
}: {
  active: StockSection;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
      <nav
        aria-label="Stock sections"
        className="flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-xs font-medium uppercase tracking-[0.06em]"
      >
        {SECTIONS.map((section) => (
          <Link
            key={section.key}
            href={section.href}
            aria-current={section.key === active ? "page" : undefined}
            className={
              section.key === active
                ? "text-ink underline decoration-signal underline-offset-4"
                : "text-ink-muted transition-colors duration-150 ease-out hover:text-ink"
            }
          >
            {section.label}
          </Link>
        ))}
      </nav>
      {children && (
        <div className="w-full sm:w-auto sm:max-w-xl sm:flex-1">{children}</div>
      )}
    </div>
  );
}
