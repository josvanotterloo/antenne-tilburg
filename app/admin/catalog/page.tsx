import { Fragment } from "react";
import Link from "next/link";

import { catalogPageNumbers, getCatalogPage } from "@/lib/catalog";

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
        <div className="overflow-x-auto rounded border border-admin-hairline bg-admin-surface">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-admin-hairline bg-admin-bg text-admin-ink-muted">
              <tr>
                <th className="px-3 py-2 font-medium">Artist</th>
                <th className="px-3 py-2 font-medium">Title</th>
                <th className="px-3 py-2 font-medium">Cat. no.</th>
                <th className="px-3 py-2 font-medium">Label</th>
                <th className="px-3 py-2 font-medium">Genre</th>
                <th className="px-3 py-2 font-medium">Type</th>
                <th className="px-3 py-2 font-medium">Condition</th>
                <th className="px-3 py-2 text-right font-medium">Price</th>
                <th className="px-3 py-2 text-center font-medium">Qty</th>
                <th className="px-3 py-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-admin-hairline">
              {result.products.map((product) => (
                <tr key={product.id}>
                  <td className="px-3 py-2">{product.artist}</td>
                  <td className="px-3 py-2">{product.title}</td>
                  <td className="px-3 py-2 text-admin-ink-muted">
                    {product.catalogNumber ?? "—"}
                  </td>
                  <td className="px-3 py-2">{product.label.name}</td>
                  <td className="px-3 py-2">{product.genre.name}</td>
                  <td className="px-3 py-2">{product.productType.name}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded px-1.5 py-0.5 text-xs ${
                        product.condition === "NEW"
                          ? "bg-green-500/15 text-green-400"
                          : "bg-admin-raised text-admin-ink"
                      }`}
                    >
                      {product.condition}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    €{Number(product.price).toFixed(2)}
                  </td>
                  <td className="px-3 py-2 text-center tabular-nums">
                    <span
                      className={`text-base font-semibold ${
                        product.quantity === 0
                          ? "text-red-400"
                          : "text-admin-ink"
                      }`}
                    >
                      {product.quantity}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-end gap-3">
                      <SellOneButton
                        id={product.id}
                        quantity={product.quantity}
                      />
                      <Link
                        href={`/admin/catalog/${product.id}/edit`}
                        className="text-admin-ink hover:underline"
                      >
                        Edit
                      </Link>
                      <DeleteProductButton id={product.id} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
