import { Fragment } from "react";
import Link from "next/link";
import type { Metadata } from "next";

import { db } from "@/lib/db";
import {
  catalogPageNumbers,
  getCatalogPage,
  isJustIn,
  stockArtistHref,
  stockLabelHref,
  type CatalogProduct,
} from "@/lib/catalog";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Stock" };

type SearchParams = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) =>
  (Array.isArray(v) ? v[0] : v) ?? undefined;

const NONE = "__none__"; // sentinel id → matches nothing when a name is unknown

// Build a /stock URL from the current params plus a patch. Filter/sort changes
// reset pagination; pass `page` in the patch to keep or set it.
function stockHref(
  current: Record<string, string | undefined>,
  patch: Record<string, string | undefined>,
): string {
  const merged = { ...current, ...patch };
  if (!("page" in patch)) delete merged.page;
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(merged)) if (v) sp.set(k, v);
  const qs = sp.toString();
  return qs ? `/stock?${qs}` : "/stock";
}

const SORTS = [
  { key: "date", label: "Date added", order: "desc" },
  { key: "artist", label: "Artist A–Z", order: "asc" },
  { key: "label", label: "Label A–Z", order: "asc" },
];

const filterLabel =
  "font-mono text-xs font-medium uppercase tracking-[0.06em] text-ink-muted";
const activeLink =
  "text-ink underline decoration-signal underline-offset-4";
const idleLink = "text-ink-muted transition-colors duration-150 ease-out hover:text-ink";

function JustInBadge() {
  return (
    <span className="ml-2 align-middle font-mono text-[0.625rem] font-bold uppercase tracking-[0.06em] text-signal">
      Just In
    </span>
  );
}

export default async function StockPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  // Sidebar filters are Genre + Condition only. Artist and label aren't sidebar
  // facets — they arrive via the clickable artist/label links on products (and are
  // shown as removable chips). Product type / just_in params are still ignored.
  const p = {
    q: one(sp.q),
    artist: one(sp.artist),
    genre: one(sp.genre),
    label: one(sp.label),
    condition: one(sp.condition) === "SECONDHAND" ? "SECONDHAND" : one(sp.condition) === "NEW" ? "NEW" : undefined,
    sort: one(sp.sort),
    order: one(sp.order),
    view: one(sp.view) === "grid" ? "grid" : undefined,
    page: one(sp.page),
  } as Record<string, string | undefined>;

  const [genres, labels] = await Promise.all([
    db.genre.findMany({ orderBy: { name: "asc" } }),
    db.label.findMany({ orderBy: { name: "asc" } }),
  ]);

  const resolve = (
    list: { id: string; name: string }[],
    name: string | undefined,
  ) =>
    name
      ? (list.find((x) => x.name.toLowerCase() === name.toLowerCase())?.id ??
        NONE)
      : undefined;

  const result = await getCatalogPage({
    q: p.q,
    artist: p.artist,
    genreId: resolve(genres, p.genre),
    labelId: resolve(labels, p.label),
    condition: p.condition as "NEW" | "SECONDHAND" | undefined,
    onlyInStock: true,
    sort: p.sort,
    order: p.order,
    page: p.page,
  });

  // Keyed by filter type, not display label: two different filters can share a
  // label (e.g. genre "House" and label "House", or q equal to a filter value),
  // which would otherwise collide as React keys.
  const activeChips = [
    p.q && { key: "q", label: `“${p.q}”`, href: stockHref(p, { q: undefined }) },
    p.artist && {
      key: "artist",
      label: p.artist,
      href: stockHref(p, { artist: undefined }),
    },
    p.genre && {
      key: "genre",
      label: p.genre,
      href: stockHref(p, { genre: undefined }),
    },
    p.label && {
      key: "label",
      label: p.label,
      href: stockHref(p, { label: undefined }),
    },
    p.condition && {
      key: "condition",
      label: p.condition,
      href: stockHref(p, { condition: undefined }),
    },
  ].filter(Boolean) as { key: string; label: string; href: string }[];

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold leading-[0.95] tracking-tight text-ink sm:text-4xl">
        Stock
      </h1>

      <form method="get" action="/stock" className="flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={p.q ?? ""}
          placeholder="Search artist, title, description…"
          className="flex-1 border border-hairline bg-canvas px-3 py-2 font-mono text-sm text-ink placeholder:text-ink-muted focus-visible:border-signal"
        />
        {/* preserve active filters when searching */}
        {["artist", "genre", "label", "condition", "sort", "order", "view"].map(
          (k) =>
            p[k] ? <input key={k} type="hidden" name={k} value={p[k]} /> : null,
        )}
        <button
          type="submit"
          className="border border-ink bg-ink px-5 py-2 font-mono text-xs font-medium uppercase tracking-[0.06em] text-canvas transition-colors duration-150 ease-out hover:border-signal hover:bg-signal"
        >
          Search
        </button>
      </form>

      {activeChips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {activeChips.map((chip) => (
            <Link
              key={chip.key}
              href={chip.href}
              className="inline-flex items-center gap-1 border border-hairline px-3 py-1 font-mono text-xs uppercase tracking-[0.05em] text-ink-muted transition-colors duration-150 ease-out hover:border-signal hover:text-ink"
            >
              {chip.label} <span aria-hidden>×</span>
            </Link>
          ))}
          <Link
            href="/stock"
            className="px-2 py-1 font-mono text-xs uppercase tracking-[0.06em] text-ink-muted underline transition-colors duration-150 ease-out hover:text-signal"
          >
            Clear all
          </Link>
        </div>
      )}

      <div className="grid gap-8 md:grid-cols-[12rem_1fr]">
        <aside className="space-y-6 font-mono text-sm">
          <FilterGroup
            title="Genre"
            options={genres}
            active={p.genre}
            param="genre"
            current={p}
          />
          <div className="space-y-1">
            <h3 className={filterLabel}>Condition</h3>
            {["NEW", "SECONDHAND"].map((c) => (
              <Link
                key={c}
                href={stockHref(p, {
                  condition: p.condition === c ? undefined : c,
                })}
                className={`block ${p.condition === c ? activeLink : idleLink}`}
              >
                {c}
              </Link>
            ))}
          </div>
        </aside>

        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-xs">
            <span className="uppercase tracking-[0.06em] text-ink-muted">
              {result.total} result{result.total === 1 ? "" : "s"}
            </span>
            <div className="flex flex-wrap items-center gap-3">
              <span className="uppercase tracking-[0.06em] text-ink-muted">
                Sort:
              </span>
              {SORTS.map((s) => {
                const active = (p.sort ?? "date") === s.key;
                return (
                  <Link
                    key={s.key}
                    href={stockHref(p, { sort: s.key, order: s.order })}
                    className={active ? activeLink : idleLink}
                  >
                    {s.label}
                  </Link>
                );
              })}
              <span className="text-hairline">|</span>
              <Link
                href={stockHref(p, {
                  view: p.view === "grid" ? undefined : "grid",
                  page: p.page,
                })}
                className={idleLink}
              >
                {p.view === "grid" ? "List view" : "Grid view"}
              </Link>
            </div>
          </div>

          {result.products.length === 0 ? (
            <p className="border border-hairline p-8 text-center font-mono text-sm text-ink-muted">
              No records match these filters.
            </p>
          ) : p.view === "grid" ? (
            <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {result.products.map((product) => (
                <li key={product.id}>
                  <ProductCard product={product} />
                </li>
              ))}
            </ul>
          ) : (
            <ul className="divide-y divide-hairline border-t border-hairline">
              {result.products.map((product) => (
                <li key={product.id}>
                  <ProductRow product={product} />
                </li>
              ))}
            </ul>
          )}

          <Pagination
            page={result.page}
            pageCount={result.pageCount}
            current={p}
          />
        </section>
      </div>
    </div>
  );
}

function FilterGroup({
  title,
  options,
  active,
  param,
  current,
}: {
  title: string;
  options: { id: string; name: string }[];
  active: string | undefined;
  param: string;
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
                href={stockHref(current, { [param]: on ? undefined : o.name })}
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

// Rows carry three distinct links (artist → filter, title/price → detail, label →
// filter) rather than one wrapping anchor, so no anchors are nested.
function ProductRow({ product }: { product: CatalogProduct }) {
  return (
    <div className="-mx-4 flex items-baseline justify-between gap-4 px-4 py-4 transition-colors duration-150 ease-out hover:bg-surface">
      <span className="min-w-0 flex-1">
        <Link
          href={stockArtistHref(product.artist)}
          className="font-medium text-ink transition-colors duration-150 ease-out hover:text-signal"
        >
          {product.artist}
        </Link>
        <span className="text-ink-muted"> — </span>
        <Link
          href={`/stock/${product.id}`}
          className="text-ink-muted transition-colors duration-150 ease-out hover:text-ink"
        >
          {product.title}
        </Link>
        {isJustIn(product.createdAt) && <JustInBadge />}
        <span className="mt-0.5 block truncate font-mono text-xs text-ink-muted">
          <Link
            href={stockLabelHref(product.label.name)}
            className="transition-colors duration-150 ease-out hover:text-signal"
          >
            {product.label.name}
          </Link>
          {" · "}
          {product.genre.name}
          {" · "}
          {product.productType.name}
        </span>
      </span>
      <Link
        href={`/stock/${product.id}`}
        className="shrink-0 font-mono text-sm tabular-nums text-ink transition-colors duration-150 ease-out hover:text-signal"
      >
        €{Number(product.price).toFixed(2)}
      </Link>
    </div>
  );
}

function ProductCard({ product }: { product: CatalogProduct }) {
  return (
    <div className="border border-hairline p-3 transition-colors duration-150 ease-out hover:border-signal">
      <Link
        href={stockArtistHref(product.artist)}
        className="block font-medium text-ink transition-colors duration-150 ease-out hover:text-signal"
      >
        {product.artist}
      </Link>
      <Link
        href={`/stock/${product.id}`}
        className="block text-sm text-ink-muted transition-colors duration-150 ease-out hover:text-ink"
      >
        {product.title}
      </Link>
      <div className="mt-1 font-mono text-xs text-ink-muted">
        <Link
          href={stockLabelHref(product.label.name)}
          className="transition-colors duration-150 ease-out hover:text-signal"
        >
          {product.label.name}
        </Link>
        {" · "}
        {product.genre.name}
      </div>
      <div className="mt-2 flex items-center justify-between">
        <Link
          href={`/stock/${product.id}`}
          className="font-mono text-sm tabular-nums text-ink transition-colors duration-150 ease-out hover:text-signal"
        >
          €{Number(product.price).toFixed(2)}
        </Link>
        {isJustIn(product.createdAt) && (
          <span className="font-mono text-[0.625rem] font-bold uppercase tracking-[0.06em] text-signal">
            Just In
          </span>
        )}
      </div>
    </div>
  );
}

function Pagination({
  page,
  pageCount,
  current,
}: {
  page: number;
  pageCount: number;
  current: Record<string, string | undefined>;
}) {
  if (pageCount <= 1) return null;
  const pages = catalogPageNumbers(page, pageCount);
  const cell =
    "border border-hairline px-2 py-1 font-mono text-xs text-ink-muted transition-colors duration-150 ease-out hover:border-signal hover:text-ink";
  return (
    <nav
      className="flex flex-wrap items-center gap-1"
      aria-label="Pagination"
    >
      {page > 1 && (
        <Link href={stockHref(current, { page: String(page - 1) })} className={cell}>
          Prev
        </Link>
      )}
      {pages.map((n, i) => (
        <Fragment key={n}>
          {i > 0 && n - pages[i - 1] > 1 && (
            <span className="px-1 font-mono text-xs text-ink-muted">…</span>
          )}
          <Link
            href={stockHref(current, { page: String(n) })}
            aria-current={n === page ? "page" : undefined}
            className={
              n === page
                ? "border border-signal bg-signal px-2 py-1 font-mono text-xs text-canvas"
                : cell
            }
          >
            {n}
          </Link>
        </Fragment>
      ))}
      {page < pageCount && (
        <Link href={stockHref(current, { page: String(page + 1) })} className={cell}>
          Next
        </Link>
      )}
    </nav>
  );
}
