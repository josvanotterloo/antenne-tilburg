import { Fragment } from "react";
import Link from "next/link";
import type { Metadata } from "next";

import { db } from "@/lib/db";
import {
  catalogPageNumbers,
  getCatalogPage,
  isJustIn,
  isRestock,
  stockArtistHref,
  stockLabelHref,
  type CatalogProduct,
} from "@/lib/catalog";
import { ProductRow } from "@/components/stock/ProductRow";
import { StockNav } from "@/components/stock/StockNav";
import {
  ActiveChips,
  ConditionFilter,
  FilterGroup,
  activeLink,
  filterHref,
  idleLink,
  one,
  parseCondition,
  resolveFilterId,
  type FilterChip,
  type SearchParams,
} from "@/components/stock/StockFilters";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Stock" };

const stockHref = (
  current: Record<string, string | undefined>,
  patch: Record<string, string | undefined>,
) => filterHref("/stock", current, patch);

const SORTS = [
  { key: "date", label: "Date added", order: "desc" },
  { key: "artist", label: "Artist A–Z", order: "asc" },
  { key: "label", label: "Label A–Z", order: "asc" },
];

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
    condition: parseCondition(one(sp.condition)),
    sort: one(sp.sort),
    order: one(sp.order),
    view: one(sp.view) === "grid" ? "grid" : undefined,
    page: one(sp.page),
  } as Record<string, string | undefined>;

  const [genres, labels] = await Promise.all([
    db.genre.findMany({ orderBy: { name: "asc" } }),
    db.label.findMany({ orderBy: { name: "asc" } }),
  ]);

  const result = await getCatalogPage({
    q: p.q,
    artist: p.artist,
    genreId: resolveFilterId(genres, p.genre),
    labelId: resolveFilterId(labels, p.label),
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
  ].filter(Boolean) as FilterChip[];

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold leading-[0.95] tracking-tight text-ink sm:text-4xl">
        Stock
      </h1>

      <StockNav active="all">
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
      </StockNav>

      <ActiveChips chips={activeChips} clearHref="/stock" />

      <div className="grid gap-8 md:grid-cols-[12rem_1fr]">
        <aside className="space-y-6 font-mono text-sm">
          <FilterGroup
            title="Genre"
            options={genres}
            active={p.genre}
            param="genre"
            basePath="/stock"
            current={p}
          />
          <ConditionFilter basePath="/stock" current={p} />
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
        {/* Grouped so both badges stay one flex child alongside the price —
            a product cannot logically be both in practice, but this stays
            correct if it ever occurs. */}
        <span className="flex items-center gap-1.5">
          {isJustIn(product.createdAt) && (
            <span className="font-mono text-[0.625rem] font-bold uppercase tracking-[0.06em] text-signal">
              Just In
            </span>
          )}
          {isRestock(product) && (
            <span className="font-mono text-[0.625rem] font-bold uppercase tracking-[0.06em] text-signal">
              Restock
            </span>
          )}
        </span>
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
