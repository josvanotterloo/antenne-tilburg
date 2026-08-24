import { Fragment } from "react";
import Link from "next/link";

import { isRestock, type CatalogProduct } from "@/lib/catalog";

const badgeClass =
  "ml-2 align-middle font-mono text-[0.625rem] font-bold uppercase tracking-[0.06em] text-signal";

export function RestockBadge() {
  return <span className={badgeClass}>Restock</span>;
}

const dataCellClass =
  "hidden truncate px-4 py-3 font-mono text-xs text-ink-muted sm:table-cell";

// One row of the /stock table (Type | Artist | Title | Label). Only
// in-stock products are ever queried onto this page, so the title is
// always a working link — no dead-end out-of-stock rows to guard against.
export function ProductRow({ product }: { product: CatalogProduct }) {
  return (
    <tr className="transition-colors duration-150 ease-out hover:bg-surface">
      <td className={dataCellClass}>{product.productType.name}</td>
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
      <td className={dataCellClass}>{product.label.name}</td>
    </tr>
  );
}
