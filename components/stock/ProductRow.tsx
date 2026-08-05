import { Fragment } from "react";
import Link from "next/link";

import { isJustIn, isRestock, type CatalogProduct } from "@/lib/catalog";

const badgeClass =
  "ml-2 align-middle font-mono text-[0.625rem] font-bold uppercase tracking-[0.06em] text-signal";

export function JustInBadge() {
  return <span className={badgeClass}>Just In</span>;
}

export function RestockBadge() {
  return <span className={badgeClass}>Restock</span>;
}

// The /stock list row. Artist, title and label are plain text/detail links —
// no price, no artist/label filter links (removed with the public filter UI).
export function ProductRow({ product }: { product: CatalogProduct }) {
  return (
    <div className="-mx-4 flex items-baseline justify-between gap-4 px-4 py-4 transition-colors duration-150 ease-out hover:bg-surface">
      <span className="min-w-0 flex-1">
        <span className="font-medium text-ink">
          {[...product.productArtists]
            .sort((a, b) => a.position - b.position)
            .map((pa, i) => (
              <Fragment key={pa.artistId}>
                {i > 0 && " / "}
                {pa.artist.name}
              </Fragment>
            ))}
        </span>
        <span className="text-ink-muted"> — </span>
        <Link
          href={`/stock/${product.id}`}
          className="text-ink-muted transition-colors duration-150 ease-out hover:text-ink"
        >
          {product.title}
        </Link>
        {isJustIn(product.createdAt) && <JustInBadge />}
        {isRestock(product) && <RestockBadge />}
        <span className="mt-0.5 block truncate font-mono text-xs text-ink-muted">
          <span>{product.label.name}</span>
          {" · "}
          {product.genre.name}
          {" · "}
          {product.productType.name}
        </span>
      </span>
    </div>
  );
}
