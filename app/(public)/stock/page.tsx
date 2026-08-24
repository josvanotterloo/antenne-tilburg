import type { Metadata } from "next";
import Link from "next/link";

import { getLatestProducts } from "@/lib/catalog";
import { ProductRow } from "@/components/stock/ProductRow";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "New Arrivals" };

type SearchParams = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) =>
  (Array.isArray(v) ? v[0] : v) ?? undefined;

const COLUMNS = [
  { key: "type", label: "Type", hideMobile: true },
  { key: "artist", label: "Artist", hideMobile: false },
  { key: "title", label: "Title", hideMobile: false },
  { key: "label", label: "Label", hideMobile: true },
] as const;

// First click on a column sorts ascending; a second click on the same
// (already-ascending) column sorts descending; anything else (a different
// column, or the same column already descending) goes back to ascending.
function sortHref(
  sort: string | undefined,
  order: string | undefined,
  col: string,
): string {
  const nextOrder = sort === col && order !== "desc" ? "desc" : "asc";
  return `/stock?sort=${col}&order=${nextOrder}`;
}

const headerCellClass =
  "px-4 py-2 font-mono text-xs uppercase tracking-[0.06em]";

export default async function StockPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const sort = one(sp.sort);
  const order = one(sp.order);

  const products = await getLatestProducts(100, true, sort, order);

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold leading-[0.95] tracking-tight text-ink sm:text-4xl">
        New Arrivals
      </h1>

      {products.length === 0 ? (
        <p className="border border-hairline p-8 text-center font-mono text-sm text-ink-muted">
          Nothing here yet.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="border-b border-hairline">
              <tr>
                {COLUMNS.map((col) => {
                  const active = sort === col.key;
                  const ascending = active && order !== "desc";
                  return (
                    <th
                      key={col.key}
                      scope="col"
                      aria-sort={
                        !active ? "none" : ascending ? "ascending" : "descending"
                      }
                      className={`${headerCellClass} ${
                        col.hideMobile ? "hidden sm:table-cell" : ""
                      }`}
                    >
                      <Link
                        href={sortHref(sort, order, col.key)}
                        className={`transition-colors duration-150 ease-out ${
                          active
                            ? "text-signal"
                            : "text-ink-muted hover:text-ink"
                        }`}
                      >
                        {col.label}
                        {active && (
                          <span aria-hidden className="ml-1">
                            {ascending ? "▲" : "▼"}
                          </span>
                        )}
                      </Link>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {products.map((product) => (
                <ProductRow key={product.id} product={product} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
