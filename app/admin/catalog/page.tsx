import { Fragment } from "react";
import Link from "next/link";

import { catalogPageNumbers, getCatalogPage } from "@/lib/catalog";
import { fullDate, relativeDate } from "@/lib/relative-date";

import { DeleteProductButton } from "./DeleteProductButton";
import { SellOneButton } from "./SellOneButton";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) =>
  (Array.isArray(v) ? v[0] : v) ?? undefined;

function adminHref(q: string | undefined, page: number): string {
  const sp = new URLSearchParams();
  if (q) sp.set("q", q);
  if (page > 1) sp.set("page", String(page));
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

  const result = await getCatalogPage({
    q,
    onlyInStock: false, // admin sees everything, incl. out of stock
    sort: "date",
    page: one(sp.page),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Catalog</h1>
          <p className="text-sm text-admin-ink-muted">
            {result.total} product{result.total === 1 ? "" : "s"} ·{" "}
            <Link href="/admin/catalog/reference" className="underline">
              Reference data
            </Link>
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
            href="/admin/catalog"
            className="rounded px-3 py-2 text-sm text-admin-ink-muted underline"
          >
            Clear
          </Link>
        )}
      </form>

      {result.products.length === 0 ? (
        <p className="rounded border border-dashed border-admin-hairline p-8 text-center text-admin-ink-muted">
          {q ? "No products match your search." : "No products yet."}
        </p>
      ) : (
        <ul className="divide-y divide-admin-hairline rounded border border-admin-hairline bg-admin-surface">
          {result.products.map((product) => (
            <li
              key={product.id}
              className="flex flex-col gap-2 p-3 md:flex-row md:items-center md:gap-4"
            >
              {/* Identity: artist — title, then label · genre · condition, then dates */}
              <div className="min-w-0 flex-1 space-y-0.5 text-sm">
                <p className="truncate">
                  <span className="font-semibold">{product.artist}</span>
                  <span className="text-admin-ink-muted"> — </span>
                  <span>{product.title}</span>
                </p>
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-admin-ink-muted">
                  <span>{product.label.name}</span>
                  <span aria-hidden>·</span>
                  <span>{product.genre.name}</span>
                  <span
                    className={`rounded px-1.5 py-0.5 ${
                      product.condition === "NEW"
                        ? "bg-green-500/15 text-green-400"
                        : "bg-admin-raised text-admin-ink"
                    }`}
                  >
                    {product.condition}
                  </span>
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

              {/* Stock, price and actions; wraps below the identity block on mobile */}
              <div className="flex items-center justify-between gap-4 text-sm md:justify-end">
                <span className="whitespace-nowrap">
                  <span
                    className={`font-semibold tabular-nums ${
                      product.quantity === 0 ? "text-red-400" : "text-admin-ink"
                    }`}
                  >
                    {product.quantity}
                  </span>
                  <span className="text-xs text-admin-ink-muted"> in stock</span>
                </span>
                <span className="tabular-nums">
                  €{Number(product.price).toFixed(2)}
                </span>
                <div className="flex items-center gap-3">
                  <SellOneButton id={product.id} quantity={product.quantity} />
                  <Link
                    href={`/admin/catalog/${product.id}/edit`}
                    className="text-admin-ink hover:underline"
                  >
                    Edit
                  </Link>
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
              href={adminHref(q, result.page - 1)}
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
                href={adminHref(q, n)}
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
              href={adminHref(q, result.page + 1)}
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
