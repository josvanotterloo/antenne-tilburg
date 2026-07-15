import Link from "next/link";

// Shared filter UI + URL helpers for /stock and the section pages
// (/stock/this-week, /stock/last-week, /stock/back-in-stock). All pages use
// name-based query params (?genre=Techno&condition=NEW) resolved to ids
// server-side; hrefs stay on the page's own basePath so a filter click
// filters within the current section.

export type SearchParams = Record<string, string | string[] | undefined>;

export const one = (v: string | string[] | undefined) =>
  (Array.isArray(v) ? v[0] : v) ?? undefined;

export function parseCondition(
  v: string | undefined,
): "NEW" | "SECONDHAND" | undefined {
  return v === "NEW" || v === "SECONDHAND" ? v : undefined;
}

// Sentinel id that matches nothing, for when a filter names an unknown value.
export const NONE = "__none__";

export function resolveFilterId(
  list: { id: string; name: string }[],
  name: string | undefined,
): string | undefined {
  return name
    ? (list.find((x) => x.name.toLowerCase() === name.toLowerCase())?.id ??
        NONE)
    : undefined;
}

// Build a URL on `basePath` from the current params plus a patch. Filter and
// sort changes reset pagination; pass `page` in the patch to keep or set it.
export function filterHref(
  basePath: string,
  current: Record<string, string | undefined>,
  patch: Record<string, string | undefined>,
): string {
  const merged = { ...current, ...patch };
  if (!("page" in patch)) delete merged.page;
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(merged)) if (v) sp.set(k, v);
  const qs = sp.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

export const filterLabel =
  "font-mono text-xs font-medium uppercase tracking-[0.06em] text-ink-muted";
export const activeLink =
  "text-ink underline decoration-signal underline-offset-4";
export const idleLink =
  "text-ink-muted transition-colors duration-150 ease-out hover:text-ink";

export function FilterGroup({
  title,
  options,
  active,
  param,
  basePath,
  current,
}: {
  title: string;
  options: { id: string; name: string }[];
  active: string | undefined;
  param: string;
  basePath: string;
  current: Record<string, string | undefined>;
}) {
  return (
    <div className="space-y-1">
      <h3 className={filterLabel}>{title}</h3>
      <ul>
        {options.map((o) => {
          const on = active?.toLowerCase() === o.name.toLowerCase();
          return (
            <li key={o.id}>
              <Link
                href={filterHref(basePath, current, {
                  [param]: on ? undefined : o.name,
                })}
                className={`block ${on ? activeLink : idleLink}`}
              >
                {o.name}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function ConditionFilter({
  basePath,
  current,
}: {
  basePath: string;
  current: Record<string, string | undefined>;
}) {
  return (
    <div className="space-y-1">
      <h3 className={filterLabel}>Condition</h3>
      {["NEW", "SECONDHAND"].map((c) => (
        <Link
          key={c}
          href={filterHref(basePath, current, {
            condition: current.condition === c ? undefined : c,
          })}
          className={`block ${current.condition === c ? activeLink : idleLink}`}
        >
          {c}
        </Link>
      ))}
    </div>
  );
}

export interface FilterChip {
  key: string;
  label: string;
  href: string;
}

export function ActiveChips({
  chips,
  clearHref,
}: {
  chips: FilterChip[];
  clearHref: string;
}) {
  if (chips.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips.map((chip) => (
        <Link
          key={chip.key}
          href={chip.href}
          className="inline-flex items-center gap-1 border border-hairline px-3 py-1 font-mono text-xs uppercase tracking-[0.05em] text-ink-muted transition-colors duration-150 ease-out hover:border-signal hover:text-ink"
        >
          {chip.label} <span aria-hidden>×</span>
        </Link>
      ))}
      <Link
        href={clearHref}
        className="px-2 py-1 font-mono text-xs uppercase tracking-[0.06em] text-ink-muted underline transition-colors duration-150 ease-out hover:text-signal"
      >
        Clear all
      </Link>
    </div>
  );
}
