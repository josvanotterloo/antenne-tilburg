import type { Metadata } from "next";

import { getLatestProducts } from "@/lib/catalog";
import { ProductRow } from "@/components/stock/ProductRow";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "New Arrivals" };

export default async function StockPage() {
  const products = await getLatestProducts();

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
