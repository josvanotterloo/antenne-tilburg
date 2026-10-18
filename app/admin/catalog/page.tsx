import { Fragment } from "react";
import Link from "next/link";

import {
  catalogPageNumbers,
  getCatalogPage,
  joinArtistNames,
  joinGenreNames,
} from "@/lib/catalog";
import { fullDate, relativeDate } from "@/lib/relative-date";
import { missingLabelFields } from "@/lib/dymo-label";
import { getOpenOrderProductIds } from "@/lib/open-order-lookup";
import { db } from "@/lib/db";
import { OrderButton } from "@/components/admin/OrderButton";

import { DeleteProductButton } from "./DeleteProductButton";
import { SellOneButton } from "./SellOneButton";
import { PlusOneButton } from "./PlusOneButton";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) =>
  (Array.isArray(v) ? v[0] : v) ?? undefined;

// Reached from a reference entity's "In use by N products" link
// (components/admin/ReferenceSection.tsx's productLinkParam) — one of these
// at a time narrows the list to that entity's products.
type FilterParam = "artistId" | "genreId" | "labelId" | "productTypeId";
const FILTER_ENTITIES: Record<
  FilterParam,
  { label: string; find: (id: string) => Promise<{ name: string } | null> }
> = {
  artistId: {
    label: "Artist",
    find: (id) => db.artist.findUnique({ where: { id }, select: { name: true } }),
  },
  genreId: {
    label: "Genre",
    find: (id) => db.genre.findUnique({ where: { id }, select: { name: true } }),
  },
  labelId: {
    label: "Label",
    find: (id) => db.label.findUnique({ where: { id }, select: { name: true } }),
  },
  productTypeId: {
    label: "Product Type",
    find: (id) =>
      db.productType.findUnique({ where: { id }, select: { name: true } }),
  },
};

type ActiveFilter = { param: FilterParam; id: string };

// "In stock only" defaults to ON — instock is only written into the
// querystring when explicitly turned off, keeping the (now-default) URL
// clean. `filter` carries the active entity filter through pagination/search
// links so it isn't lost by navigating; omit it to drop the filter (the
// "Clear" link on the filter banner does this).
function adminHref(
  q: string | undefined,
  page: number,
  instock: boolean,
  filter?: ActiveFilter,
): string {
  const sp = new URLSearchParams();
  if (q) sp.set("q", q);
  if (page > 1) sp.set("page", String(page));
  if (!instock) sp.set("instock", "false");
  if (filter) sp.set(filter.param, filter.id);
  const qs = sp.toString();
  return qs ? `/admin/catalog?${qs}` : "/admin/catalog";
}

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const q = one(sp.q);
  const instock = one(sp.instock) !== "false";

  // At most one entity filter is honored at a time — if more than one param
  // is present (not reachable via this app's own links), the first match in
  // this fixed order wins.
  const activeFilter: ActiveFilter | undefined = (
    ["artistId", "genreId", "labelId", "productTypeId"] as FilterParam[]
  )
    .map((param) => ({ param, id: one(sp[param]) }))
    .find((f): f is ActiveFilter => !!f.id);

  const [result, filterEntity] = await Promise.all([
    getCatalogPage({
      q,
      onlyInStock: instock,
      sort: "date",
      page: one(sp.page),
      artistIds: activeFilter?.param === "artistId" ? [activeFilter.id] : undefined,
      genreId: activeFilter?.param === "genreId" ? activeFilter.id : undefined,
      labelId: activeFilter?.param === "labelId" ? activeFilter.id : undefined,
      productTypeId:
        activeFilter?.param === "productTypeId" ? activeFilter.id : undefined,
    }),
    activeFilter
      ? FILTER_ENTITIES[activeFilter.param].find(activeFilter.id)
      : Promise.resolve(null),
  ]);

  const openOrderProductIds = await getOpenOrderProductIds(
    result.products.map((p) => p.id),
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Products</h1>
          <p className="text-sm text-admin-ink-muted">
            {result.total} product{result.total === 1 ? "" : "s"}
          </p>
        </div>
        <Link
          href="/admin/catalog/new"
          className="rounded bg-admin-ink transition-colors duration-150 ease-out hover:bg-signal px-3 py-2 text-sm font-medium text-admin-bg"
        >
          Add product
        </Link>
      </div>

      <form method="get" action="/admin/catalog" className="flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search artist, title, description…"
          className="w-full max-w-sm rounded border border-admin-hairline px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="rounded border border-admin-hairline px-3 py-2 text-sm"
        >
          Search
        </button>
        {q && (
          <Link
            href={adminHref(undefined, 1, instock, activeFilter)}
            className="rounded px-3 py-2 text-sm text-admin-ink-muted underline"
          >
            Clear
          </Link>
        )}
        <Link
          href={adminHref(q, 1, !instock, activeFilter)}
          aria-pressed={instock}
          className={`rounded border px-3 py-2 text-sm ${
            instock
              ? "border-signal bg-signal/10 text-signal"
              : "border-admin-hairline text-admin-ink-muted"
          }`}
        >
          In stock only
        </Link>
      </form>

      {activeFilter && (
        <p className="text-sm text-admin-ink-muted">
          Filtered by {FILTER_ENTITIES[activeFilter.param].label}
          {filterEntity ? `: ${filterEntity.name}` : ""}
          <span aria-hidden> · </span>
          <Link href={adminHref(q, 1, instock)} className="underline">
            Clear filter
          </Link>
        </p>
      )}

      {result.products.length === 0 ? (
        <p className="rounded border border-dashed border-admin-hairline p-8 text-center text-admin-ink-muted">
          {q
            ? "No products match your search."
            : activeFilter
              ? "No products match this filter."
              : "No products yet."}
        </p>
      ) : (
        <ul className="divide-y divide-admin-hairline rounded border border-admin-hairline bg-admin-surface">
          {result.products.map((product) => (
            <li
              key={product.id}
              className="flex flex-col gap-2 p-3 md:flex-row md:items-center md:gap-4"
            >
              {/* Identity: artist — title, then label · genre, then dates */}
              <div className="min-w-0 flex-1 space-y-0.5 text-sm">
                <p className="truncate">
                  <span className="font-semibold">
                    {joinArtistNames(product.productArtists)}
                  </span>
                  <span className="text-admin-ink-muted"> — </span>
                  <span>{product.title}</span>
                </p>
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-admin-ink-muted">
                  <span>{product.label.name}</span>
                  <span aria-hidden>·</span>
                  <span>{joinGenreNames(product.productGenres)}</span>
                </p>
                <p className="text-xs text-admin-ink-muted">
                  <span title={fullDate(product.createdAt)}>
                    Added {relativeDate(product.createdAt)}
                  </span>
                  <span aria-hidden> · </span>
                  <span title={fullDate(product.updatedAt)}>
                    Updated {relativeDate(product.updatedAt)}
                  </span>
                </p>
              </div>

              {/* Stock, price and actions; wraps below the identity block on
                  mobile. Fixed grid columns keep quantity/price/every
                  action control aligned row-to-row regardless of digit
                  count or button label length. */}
              <div className="grid grid-cols-[104px_76px_84px_56px_84px_32px_48px_56px] items-center gap-3 text-sm">
                <div className="text-right">
                  <span
                    className={`font-semibold tabular-nums ${
                      product.quantity === 0 ? "text-red-400" : "text-admin-ink"
                    }`}
                  >
                    {product.quantity}
                  </span>
                  <span className="text-xs text-admin-ink-muted"> in stock</span>
                </div>
                <div className="text-right tabular-nums">
                  €{Number(product.price).toFixed(2)}
                </div>
                <div className="flex justify-center">
                  <SellOneButton id={product.id} quantity={product.quantity} />
                </div>
                <div className="flex justify-center">
                  <PlusOneButton id={product.id} />
                </div>
                <div className="flex justify-center">
                  <OrderButton
                    productId={product.id}
                    hasSupplier={!!product.supplierId}
                    initiallyOrdered={openOrderProductIds.has(product.id)}
                  />
                </div>
                <div className="flex justify-center">
                  {missingLabelFields(product).length === 0 && (
                    <a
                      href={`/api/admin/label/${product.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Print label"
                      title="Print label"
                      className="text-admin-ink hover:underline"
                    >
                      🖨️
                    </a>
                  )}
                </div>
                <div className="flex justify-center">
                  <Link
                    href={`/admin/catalog/${product.id}/edit`}
                    className="text-admin-ink hover:underline"
                  >
                    Edit
                  </Link>
                </div>
                <div className="flex justify-center">
                  <DeleteProductButton id={product.id} />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {result.pageCount > 1 && (
        <nav
          className="flex items-center gap-1 text-sm"
          aria-label="Pagination"
        >
          {result.page > 1 && (
            <Link
              href={adminHref(q, result.page - 1, instock, activeFilter)}
              className="rounded border border-admin-hairline px-2 py-1 hover:bg-admin-raised"
            >
              Prev
            </Link>
          )}
          {catalogPageNumbers(result.page, result.pageCount).map((n, i, arr) => (
            <Fragment key={n}>
              {i > 0 && n - arr[i - 1] > 1 && (
                <span className="px-1 text-admin-ink-muted">…</span>
              )}
              <Link
                href={adminHref(q, n, instock, activeFilter)}
                aria-current={n === result.page ? "page" : undefined}
                className={`rounded px-2 py-1 ${
                  n === result.page
                    ? "bg-admin-ink text-admin-bg"
                    : "border border-admin-hairline hover:bg-admin-raised"
                }`}
              >
                {n}
              </Link>
            </Fragment>
          ))}
          {result.page < result.pageCount && (
            <Link
              href={adminHref(q, result.page + 1, instock, activeFilter)}
              className="rounded border border-admin-hairline px-2 py-1 hover:bg-admin-raised"
            >
              Next
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
