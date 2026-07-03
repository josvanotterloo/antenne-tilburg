import { Fragment } from "react";
import Link from "next/link";
import type { Metadata } from "next";

import { db } from "@/lib/db";
import {
  catalogPageNumbers,
  getCatalogPage,
  isJustIn,
  JUST_IN_DAYS,
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

export default async function StockPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const p = {
    q: one(sp.q),
    genre: one(sp.genre),
    label: one(sp.label),
    type: one(sp.type),
    condition: one(sp.condition) === "SECONDHAND" ? "SECONDHAND" : one(sp.condition) === "NEW" ? "NEW" : undefined,
    just_in: one(sp.just_in) === "true" ? "true" : undefined,
    sort: one(sp.sort),
    order: one(sp.order),
    view: one(sp.view) === "grid" ? "grid" : undefined,
    page: one(sp.page),
  } as Record<string, string | undefined>;

  const [genres, labels, types] = await Promise.all([
    db.genre.findMany({ orderBy: { name: "asc" } }),
    db.label.findMany({ orderBy: { name: "asc" } }),
    db.productType.findMany({ orderBy: { name: "asc" } }),
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
    genreId: resolve(genres, p.genre),
    labelId: resolve(labels, p.label),
    productTypeId: resolve(types, p.type),
    condition: p.condition as "NEW" | "SECONDHAND" | undefined,
    justIn: p.just_in === "true",
    onlyInStock: true,
    sort: p.sort,
    order: p.order,
    page: p.page,
  });

  const activeChips = [
    p.q && { label: `“${p.q}”`, href: stockHref(p, { q: undefined }) },
    p.genre && { label: p.genre, href: stockHref(p, { genre: undefined }) },
    p.label && { label: p.label, href: stockHref(p, { label: undefined }) },
    p.type && { label: p.type, href: stockHref(p, { type: undefined }) },
    p.condition && {
      label: p.condition,
      href: stockHref(p, { condition: undefined }),
    },
    p.just_in && {
      label: "Just In",
      href: stockHref(p, { just_in: undefined }),
    },
  ].filter(Boolean) as { label: string; href: string }[];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Stock</h1>

      <form method="get" action="/stock" className="flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={p.q ?? ""}
          placeholder="Search artist, title, description…"
          className="flex-1 rounded border border-neutral-300 px-3 py-2 text-sm"
        />
        {/* preserve active filters when searching */}
        {[
          "genre",
          "label",
          "type",
          "condition",
          "just_in",
          "sort",
          "order",
          "view",
        ].map((k) =>
          p[k] ? <input key={k} type="hidden" name={k} value={p[k]} /> : null,
        )}
        <button
          type="submit"
          className="rounded bg-neutral-900 px-4 py-2 text-sm text-white"
        >
          Search
        </button>
      </form>

      {activeChips.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {activeChips.map((chip) => (
            <Link
              key={chip.label}
              href={chip.href}
              className="inline-flex items-center gap-1 rounded-full bg-neutral-200 px-3 py-1 text-xs hover:bg-neutral-300"
            >
              {chip.label} <span aria-hidden>×</span>
            </Link>
          ))}
          <Link href="/stock" className="px-2 py-1 text-xs underline">
            Clear all
          </Link>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-[12rem_1fr]">
        <aside className="space-y-4 text-sm">
          <FilterGroup
            title="Genre"
            options={genres}
            active={p.genre}
            param="genre"
            current={p}
          />
          <FilterGroup
            title="Label"
            options={labels}
            active={p.label}
            param="label"
            current={p}
          />
          <FilterGroup
            title="Product type"
            options={types}
            active={p.type}
            param="type"
            current={p}
          />
          <div>
            <h3 className="font-semibold">Condition</h3>
            {["NEW", "SECONDHAND"].map((c) => (
              <Link
                key={c}
                href={stockHref(p, {
                  condition: p.condition === c ? undefined : c,
                })}
                className={`block ${p.condition === c ? "font-semibold underline" : "text-neutral-600 hover:underline"}`}
              >
                {c}
              </Link>
            ))}
          </div>
          <Link
            href={stockHref(p, { just_in: p.just_in ? undefined : "true" })}
            className={`block ${p.just_in ? "font-semibold underline" : "text-neutral-600 hover:underline"}`}
          >
            Just In (last {JUST_IN_DAYS} days)
          </Link>
        </aside>

        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="text-neutral-500">
              {result.total} result{result.total === 1 ? "" : "s"}
            </span>
            <div className="flex items-center gap-3">
              <span className="text-neutral-500">Sort:</span>
              {SORTS.map((s) => {
                const active = (p.sort ?? "date") === s.key;
                return (
                  <Link
                    key={s.key}
                    href={stockHref(p, { sort: s.key, order: s.order })}
                    className={
                      active
                        ? "font-semibold underline"
                        : "text-neutral-600 hover:underline"
                    }
                  >
                    {s.label}
                  </Link>
                );
              })}
              <span className="text-neutral-300">|</span>
              <Link
                href={stockHref(p, {
                  view: p.view === "grid" ? undefined : "grid",
                  page: p.page,
                })}
                className="text-neutral-600 hover:underline"
              >
                {p.view === "grid" ? "List view" : "Grid view"}
              </Link>
            </div>
          </div>

          {result.products.length === 0 ? (
            <p className="rounded border border-dashed border-neutral-300 p-8 text-center text-neutral-500">
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
            <ul className="divide-y divide-neutral-100">
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
    <div>
      <h3 className="font-semibold">{title}</h3>
      <ul>
        {options.map((o) => {
          const on = active?.toLowerCase() === o.name.toLowerCase();
          return (
            <li key={o.id}>
              <Link
                href={stockHref(current, {
                  [param]: on ? undefined : o.name,
                })}
                className={
                  on
                    ? "font-semibold underline"
                    : "text-neutral-600 hover:underline"
                }
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

function ProductRow({ product }: { product: CatalogProduct }) {
  return (
    <Link
      href={`/stock/${product.id}`}
      className="flex items-baseline justify-between gap-4 py-2 hover:bg-neutral-50"
    >
      <span className="flex-1">
        <span className="font-medium">{product.artist}</span>
        {" — "}
        {product.title}
        {isJustIn(product.createdAt) && (
          <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">
            Just In
          </span>
        )}
        <span className="block text-xs text-neutral-500">
          {product.label.name} · {product.genre.name} ·{" "}
          {product.productType.name}
        </span>
      </span>
      <span className="tabular-nums">€{Number(product.price).toFixed(2)}</span>
    </Link>
  );
}

function ProductCard({ product }: { product: CatalogProduct }) {
  return (
    <Link
      href={`/stock/${product.id}`}
      className="block rounded border border-neutral-200 p-3 hover:border-neutral-400"
    >
      <div className="text-sm font-medium">{product.artist}</div>
      <div className="text-sm">{product.title}</div>
      <div className="mt-1 text-xs text-neutral-500">
        {product.label.name} · {product.genre.name}
      </div>
      <div className="mt-2 flex items-center justify-between">
        <span className="tabular-nums text-sm">
          €{Number(product.price).toFixed(2)}
        </span>
        {isJustIn(product.createdAt) && (
          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">
            Just In
          </span>
        )}
      </div>
    </Link>
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
  return (
    <nav className="flex flex-wrap items-center gap-1 text-sm" aria-label="Pagination">
      {page > 1 && (
        <Link
          href={stockHref(current, { page: String(page - 1) })}
          className="rounded border border-neutral-300 px-2 py-1 hover:bg-neutral-100"
        >
          Prev
        </Link>
      )}
      {pages.map((n, i) => (
        <Fragment key={n}>
          {i > 0 && n - pages[i - 1] > 1 && (
            <span className="px-1 text-neutral-400">…</span>
          )}
          <Link
            href={stockHref(current, { page: String(n) })}
            aria-current={n === page ? "page" : undefined}
            className={`rounded px-2 py-1 ${
              n === page
                ? "bg-neutral-900 text-white"
                : "border border-neutral-300 hover:bg-neutral-100"
            }`}
          >
            {n}
          </Link>
        </Fragment>
      ))}
      {page < pageCount && (
        <Link
          href={stockHref(current, { page: String(page + 1) })}
          className="rounded border border-neutral-300 px-2 py-1 hover:bg-neutral-100"
        >
          Next
        </Link>
      )}
    </nav>
  );
}
