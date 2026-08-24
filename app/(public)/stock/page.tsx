import type { Metadata } from "next";
import Link from "next/link";

import { getLatestProducts } from "@/lib/catalog";
import { ProductRow } from "@/components/stock/ProductRow";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "New Arrivals" };

type SearchParams = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) =>
  (Array.isArray(v) ? v[0] : v) ?? undefined;

export default async function StockPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const instock = one(sp.instock) === "true";

  const products = await getLatestProducts(100, instock);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-bold leading-[0.95] tracking-tight text-ink sm:text-4xl">
          New Arrivals
        </h1>
        <Link
          href={instock ? "/stock" : "/stock?instock=true"}
          aria-pressed={instock}
          className={`rounded border px-3 py-1.5 font-mono text-xs uppercase tracking-[0.06em] transition-colors duration-150 ease-out ${
            instock
              ? "border-signal bg-signal/10 text-signal"
              : "border-hairline text-ink-muted hover:text-ink"
          }`}
        >
          In stock only
        </Link>
      </div>

      {products.length === 0 ? (
        <p className="border border-hairline p-8 text-center font-mono text-sm text-ink-muted">
          Nothing here yet.
        </p>
      ) : (
        <ul className="divide-y divide-hairline border-t border-hairline">
          {products.map((product) => (
            <li key={product.id}>
              <ProductRow product={product} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
