import type { CatalogProduct } from "@/lib/catalog";
import { ProductRow } from "@/components/stock/ProductRow";
import { StockNav, type StockSection } from "@/components/stock/StockNav";

// Shared shell for the weekly section pages (/stock/this-week, /stock/last-week,
// /stock/back-in-stock): heading, back link, the /stock row list, empty state.
// No pagination — weekly additions for a physical shop stay manageable.
export function SectionPage({
  heading,
  active,
  products,
}: {
  heading: string;
  active: StockSection;
  products: CatalogProduct[];
}) {
  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold leading-[0.95] tracking-tight text-ink sm:text-4xl">
        {heading}
      </h1>

      <StockNav active={active} />

      {products.length === 0 ? (
        <p className="border border-hairline p-8 text-center font-mono text-sm text-ink-muted">
          Nothing yet.
        </p>
      ) : (
        <ul className="divide-y divide-hairline border-t border-hairline">
          {products.map((product) => (
            <li key={product.id}>
              <ProductRow product={product} showCondition />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
