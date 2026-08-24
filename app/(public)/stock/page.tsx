import type { Metadata } from "next";

import { getLatestProducts } from "@/lib/catalog";
import { ProductRow, StockTableHead } from "@/components/stock/ProductRow";

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
            <StockTableHead sort={sort} order={order} />
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
