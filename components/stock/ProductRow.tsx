import { Fragment } from "react";
import Link from "next/link";

import { isRestock, type CatalogProduct } from "@/lib/catalog";

const badgeClass =
  "ml-2 align-middle font-mono text-[0.625rem] font-bold uppercase tracking-[0.06em] text-signal";

export function RestockBadge() {
  return <span className={badgeClass}>Restock</span>;
}

// Single source of truth for the /stock table's column shape — shared by
// StockTableHead (headers) and ProductRow (data cells) below so the two
// can never desync on which columns hide on mobile.
export const COLUMNS = [
  { key: "type", label: "Type", hideMobile: true },
  { key: "artist", label: "Artist", hideMobile: false },
  { key: "title", label: "Title", hideMobile: false },
  { key: "label", label: "Label", hideMobile: true },
] as const;

function hideMobile(key: (typeof COLUMNS)[number]["key"]): boolean {
  return COLUMNS.find((c) => c.key === key)!.hideMobile;
}

function dataCellClass(key: (typeof COLUMNS)[number]["key"]): string {
  return `truncate px-4 py-3 font-mono text-xs text-ink-muted ${
    hideMobile(key) ? "hidden sm:table-cell" : ""
  }`;
}

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

export function StockTableHead({
  sort,
  order,
}: {
  sort: string | undefined;
  order: string | undefined;
}) {
  return (
    <thead className="border-b border-hairline">
      <tr>
        {COLUMNS.map((col) => {
          const active = sort === col.key;
          const ascending = active && order !== "desc";
          return (
            <th
              key={col.key}
              scope="col"
              aria-sort={!active ? "none" : ascending ? "ascending" : "descending"}
              className={`px-4 py-2 font-mono text-xs uppercase tracking-[0.06em] ${
                col.hideMobile ? "hidden sm:table-cell" : ""
              }`}
            >
              <Link
                href={sortHref(sort, order, col.key)}
                className={`transition-colors duration-150 ease-out ${
                  active ? "text-signal" : "text-ink-muted hover:text-ink"
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
  );
}

// One row of the /stock table (Type | Artist | Title | Label). Only
// in-stock products are ever queried onto this page, so the title is
// always a working link — no dead-end out-of-stock rows to guard against.
export function ProductRow({ product }: { product: CatalogProduct }) {
  return (
    <tr className="transition-colors duration-150 ease-out hover:bg-surface">
      <td className={dataCellClass("type")}>{product.productType.name}</td>
      <td className="truncate px-4 py-3 font-mono text-xs uppercase text-ink-muted">
        {product.isVariousArtists
          ? "VARIOUS ARTISTS"
          : [...product.productArtists]
              .sort((a, b) => a.position - b.position)
              .map((pa, i) => (
                <Fragment key={pa.artistId}>
                  {i > 0 && " / "}
                  {pa.artist.name}
                </Fragment>
              ))}
      </td>
      <td className="px-4 py-3 text-sm text-ink">
        <Link
          href={`/stock/${product.id}`}
          className="text-signal transition-colors duration-150 ease-out hover:underline"
        >
          {product.title}
        </Link>
        {isRestock(product) && <RestockBadge />}
      </td>
      <td className={dataCellClass("label")}>{product.label.name}</td>
    </tr>
  );
}
