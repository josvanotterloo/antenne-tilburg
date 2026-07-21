import Link from "next/link";

import {
  isJustIn,
  isRestock,
  stockArtistHref,
  stockLabelHref,
  type CatalogProduct,
} from "@/lib/catalog";

const badgeClass =
  "ml-2 align-middle font-mono text-[0.625rem] font-bold uppercase tracking-[0.06em] text-signal";

export function JustInBadge() {
  return <span className={badgeClass}>Just In</span>;
}

export function RestockBadge() {
  return <span className={badgeClass}>Restock</span>;
}

// The /stock list row, shared with the weekly section pages. Rows carry three
// distinct links (artist → filter, title/price → detail, label → filter)
// rather than one wrapping anchor, so no anchors are nested.
export function ProductRow({
  product,
  showCondition,
}: {
  product: CatalogProduct;
  showCondition?: boolean;
}) {
  return (
    <div className="-mx-4 flex items-baseline justify-between gap-4 px-4 py-4 transition-colors duration-150 ease-out hover:bg-surface">
      <span className="min-w-0 flex-1">
        <Link
          href={stockArtistHref(product.artist)}
          className="font-medium text-ink transition-colors duration-150 ease-out hover:text-signal"
        >
          {product.artist}
        </Link>
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
          <Link
            href={stockLabelHref(product.label.name)}
            className="transition-colors duration-150 ease-out hover:text-signal"
          >
            {product.label.name}
          </Link>
          {" · "}
          {product.genre.name}
          {" · "}
          {product.productType.name}
          {showCondition && (
            <>
              {" · "}
              {product.condition}
            </>
          )}
        </span>
      </span>
      <Link
        href={`/stock/${product.id}`}
        className="shrink-0 font-mono text-sm tabular-nums text-ink transition-colors duration-150 ease-out hover:text-signal"
      >
        €{Number(product.price).toFixed(2)}
      </Link>
    </div>
  );
}
