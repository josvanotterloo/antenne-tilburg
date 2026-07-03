import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { db } from "@/lib/db";
import { isJustIn } from "@/lib/catalog";

export const dynamic = "force-dynamic";

function getProduct(id: string) {
  return db.product.findUnique({
    where: { id },
    include: { label: true, genre: true, productType: true },
  });
}

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

  return (
    <article className="space-y-6">
      <Link href="/stock" className="text-sm text-neutral-500 hover:underline">
        ← Back to stock
      </Link>

      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">
          {product.artist} — {product.title}
          {justIn && (
            <span className="ml-2 rounded bg-amber-100 px-2 py-0.5 text-xs align-middle text-amber-800">
              Just In
            </span>
          )}
        </h1>
        <p className="text-neutral-500">
          {product.label.name} · {product.genre.name} ·{" "}
          {product.productType.name}
        </p>
      </header>

      <dl className="grid grid-cols-[8rem_1fr] gap-y-2 text-sm">
        <dt className="text-neutral-500">Artist</dt>
        <dd>{product.artist}</dd>
        <dt className="text-neutral-500">Title</dt>
        <dd>{product.title}</dd>
        {product.catalogNumber && (
          <>
            <dt className="text-neutral-500">Catalog no.</dt>
            <dd>{product.catalogNumber}</dd>
          </>
        )}
        <dt className="text-neutral-500">Label</dt>
        <dd>{product.label.name}</dd>
        <dt className="text-neutral-500">Genre</dt>
        <dd>{product.genre.name}</dd>
        <dt className="text-neutral-500">Type</dt>
        <dd>{product.productType.name}</dd>
        <dt className="text-neutral-500">Condition</dt>
        <dd>{product.condition}</dd>
        <dt className="text-neutral-500">Price</dt>
        <dd className="tabular-nums">€{Number(product.price).toFixed(2)}</dd>
      </dl>

      {product.description && (
        <p className="max-w-prose text-neutral-700">{product.description}</p>
      )}
    </article>
  );
}
