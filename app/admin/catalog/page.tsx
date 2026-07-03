import Link from "next/link";

import { getCatalogPage } from "@/lib/catalog";

import { DeleteProductButton } from "./DeleteProductButton";

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
          <p className="text-sm text-neutral-500">
            {result.total} product{result.total === 1 ? "" : "s"} ·{" "}
            <Link href="/admin/catalog/reference" className="underline">
              Reference data
            </Link>
          </p>
        </div>
        <Link
          href="/admin/catalog/new"
          className="rounded bg-neutral-900 px-3 py-2 text-sm font-medium text-white"
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
          className="w-full max-w-sm rounded border border-neutral-300 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="rounded border border-neutral-300 px-3 py-2 text-sm"
        >
          Search
        </button>
        {q && (
          <Link
            href="/admin/catalog"
            className="rounded px-3 py-2 text-sm text-neutral-500 underline"
          >
            Clear
          </Link>
        )}
      </form>

      {result.products.length === 0 ? (
        <p className="rounded border border-dashed border-neutral-300 p-8 text-center text-neutral-500">
          {q ? "No products match your search." : "No products yet."}
        </p>
      ) : (
        <div className="overflow-x-auto rounded border border-neutral-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 text-neutral-500">
              <tr>
                <th className="px-3 py-2 font-medium">Artist</th>
                <th className="px-3 py-2 font-medium">Title</th>
                <th className="px-3 py-2 font-medium">Cat. no.</th>
                <th className="px-3 py-2 font-medium">Label</th>
                <th className="px-3 py-2 font-medium">Genre</th>
                <th className="px-3 py-2 font-medium">Type</th>
                <th className="px-3 py-2 font-medium">Condition</th>
                <th className="px-3 py-2 text-right font-medium">Price</th>
                <th className="px-3 py-2 text-center font-medium">In stock</th>
                <th className="px-3 py-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {result.products.map((product) => (
                <tr key={product.id}>
                  <td className="px-3 py-2">{product.artist}</td>
                  <td className="px-3 py-2">{product.title}</td>
                  <td className="px-3 py-2 text-neutral-500">
                    {product.catalogNumber ?? "—"}
                  </td>
                  <td className="px-3 py-2">{product.label.name}</td>
                  <td className="px-3 py-2">{product.genre.name}</td>
                  <td className="px-3 py-2">{product.productType.name}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded px-1.5 py-0.5 text-xs ${
                        product.condition === "NEW"
                          ? "bg-green-100 text-green-800"
                          : "bg-neutral-200 text-neutral-700"
                      }`}
                    >
                      {product.condition}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    €{Number(product.price).toFixed(2)}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {product.inStock ? "✓" : "✗"}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-3">
                      <Link
                        href={`/admin/catalog/${product.id}/edit`}
                        className="text-neutral-700 hover:underline"
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
              className="rounded border border-neutral-300 px-2 py-1 hover:bg-neutral-100"
            >
              Prev
            </Link>
          )}
          {Array.from({ length: result.pageCount }, (_, i) => i + 1).map((n) => (
            <Link
              key={n}
              href={adminHref(q, n)}
              aria-current={n === result.page ? "page" : undefined}
              className={`rounded px-2 py-1 ${
                n === result.page
                  ? "bg-neutral-900 text-white"
                  : "border border-neutral-300 hover:bg-neutral-100"
              }`}
            >
              {n}
            </Link>
          ))}
          {result.page < result.pageCount && (
            <Link
              href={adminHref(q, result.page + 1)}
              className="rounded border border-neutral-300 px-2 py-1 hover:bg-neutral-100"
            >
              Next
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
