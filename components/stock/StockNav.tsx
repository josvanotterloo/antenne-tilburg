import Link from "next/link";

const SECTIONS = [
  { key: "all", label: "All Stock", href: "/stock" },
  { key: "this-week", label: "This Week", href: "/stock/this-week" },
  { key: "last-week", label: "Last Week", href: "/stock/last-week" },
  { key: "back-in-stock", label: "Back In Stock", href: "/stock/back-in-stock" },
] as const;

export type StockSection = (typeof SECTIONS)[number]["key"];

// Search on the section pages submits to /stock — the sections don't filter
// by search term, the full listing does.
function DefaultSearchForm() {
  return (
    <form method="get" action="/stock" className="flex gap-2">
      <input
        type="search"
        name="q"
        placeholder="Search artist, title, description…"
        className="flex-1 border border-hairline bg-canvas px-3 py-2 font-mono text-sm text-ink placeholder:text-ink-muted focus-visible:border-signal"
      />
      <button
        type="submit"
        className="border border-ink bg-ink px-5 py-2 font-mono text-xs font-medium uppercase tracking-[0.06em] text-canvas transition-colors duration-150 ease-out hover:border-signal hover:bg-signal"
      >
        Search
      </button>
    </form>
  );
}

// Persistent navigation across the stock surfaces. The active section gets
// the signal underline (DESIGN.md nav rule). The search slot always renders:
// /stock passes its filter-preserving form as children; the section pages
// get the default form above. On small screens the search wraps onto its
// own row below the links.
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
      <div className="w-full sm:w-auto sm:max-w-xl sm:flex-1">
        {children ?? <DefaultSearchForm />}
      </div>
    </div>
  );
}
