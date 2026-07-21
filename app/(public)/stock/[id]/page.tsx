import { cache } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { db } from "@/lib/db";
import {
  isJustIn,
  isRestock,
  stockArtistHref,
  stockLabelHref,
} from "@/lib/catalog";

export const dynamic = "force-dynamic";

// generateMetadata and the page both fetch the product; React.cache dedupes the two
// identical lookups into one query per request.
const getProduct = cache((id: string) =>
  db.product.findUnique({
    where: { id },
    include: { label: true, genre: true, productType: true },
  }),
);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const product = await getProduct(id);
  if (!product || !product.inStock) {
    return { title: "Not found" };
  }
  return {
    title: `${product.artist} — ${product.title}`,
    description:
      product.description ??
      `${product.artist} — ${product.title} (${product.productType.name}) on ${product.label.name}.`,
  };
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const product = await getProduct(id);
  // Out-of-stock products are not public.
  if (!product || !product.inStock) notFound();

  const justIn = isJustIn(product.createdAt);
  const restock = isRestock(product);

  const dt = "font-mono text-xs uppercase tracking-[0.06em] text-ink-muted";

  return (
    <article className="space-y-8">
      <Link
        href="/stock"
        className="font-mono text-xs uppercase tracking-[0.06em] text-ink-muted transition-colors duration-150 ease-out hover:text-signal"
      >
        ← Back to stock
      </Link>

      <header className="space-y-2">
        <h1 className="text-balance text-2xl font-bold tracking-tight text-ink sm:text-3xl">
          <Link
            href={stockArtistHref(product.artist)}
            className="transition-colors duration-150 ease-out hover:text-signal"
          >
            {product.artist}
          </Link>{" "}
          — {product.title}
          {justIn && (
            <span className="ml-2 align-middle font-mono text-[0.6875rem] font-bold uppercase tracking-[0.06em] text-signal">
              Just In
            </span>
          )}
          {restock && (
            <span className="ml-2 align-middle font-mono text-[0.6875rem] font-bold uppercase tracking-[0.06em] text-signal">
              Restock
            </span>
          )}
        </h1>
        <p className="font-mono text-sm text-ink-muted">
          <Link
            href={stockLabelHref(product.label.name)}
            className="transition-colors duration-150 ease-out hover:text-signal"
          >
            {product.label.name}
          </Link>{" "}
          · {product.genre.name} · {product.productType.name}
        </p>
      </header>

      <dl className="grid grid-cols-[8rem_1fr] border-t border-hairline text-sm">
        <dt className={`${dt} border-b border-hairline py-2`}>Artist</dt>
        <dd className="border-b border-hairline py-2">
          <Link
            href={stockArtistHref(product.artist)}
            className="text-ink transition-colors duration-150 ease-out hover:text-signal"
          >
            {product.artist}
          </Link>
        </dd>
        <dt className={`${dt} border-b border-hairline py-2`}>Title</dt>
        <dd className="border-b border-hairline py-2 text-ink">{product.title}</dd>
        {product.catalogNumber && (
          <>
            <dt className={`${dt} border-b border-hairline py-2`}>Catalog no.</dt>
            <dd className="border-b border-hairline py-2 font-mono text-ink">
              {product.catalogNumber}
            </dd>
          </>
        )}
        <dt className={`${dt} border-b border-hairline py-2`}>Label</dt>
        <dd className="border-b border-hairline py-2">
          <Link
            href={stockLabelHref(product.label.name)}
            className="text-ink transition-colors duration-150 ease-out hover:text-signal"
          >
            {product.label.name}
          </Link>
        </dd>
        <dt className={`${dt} border-b border-hairline py-2`}>Genre</dt>
        <dd className="border-b border-hairline py-2 text-ink">{product.genre.name}</dd>
        <dt className={`${dt} border-b border-hairline py-2`}>Type</dt>
        <dd className="border-b border-hairline py-2 text-ink">
          {product.productType.name}
        </dd>
        <dt className={`${dt} border-b border-hairline py-2`}>Condition</dt>
        <dd className="border-b border-hairline py-2 font-mono text-ink">
          {product.condition}
        </dd>
        <dt className={`${dt} border-b border-hairline py-2`}>Price</dt>
        <dd className="border-b border-hairline py-2 font-mono tabular-nums text-ink">
          €{Number(product.price).toFixed(2)}
        </dd>
      </dl>

      {product.description && (
        <p className="max-w-prose text-pretty leading-relaxed text-ink">
          {product.description}
        </p>
      )}
    </article>
  );
}
