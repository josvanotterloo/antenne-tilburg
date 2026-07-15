import type { CatalogProduct } from "@/lib/catalog";
import { ProductRow } from "@/components/stock/ProductRow";
import { StockNav, type StockSection } from "@/components/stock/StockNav";
import {
  ActiveChips,
  ConditionFilter,
  FilterGroup,
  filterHref,
  type FilterChip,
} from "@/components/stock/StockFilters";

// Shared shell for the weekly section pages (/stock/this-week, /stock/last-week,
// /stock/back-in-stock): heading, persistent stock nav, genre/condition sidebar
// scoped to the section (a filter click filters within it), removable chips,
// the /stock row list, empty state. No pagination — weekly additions for a
// physical shop stay manageable.
export function SectionPage({
  heading,
  active,
  basePath,
  genres,
  params,
  products,
}: {
  heading: string;
  active: StockSection;
  basePath: string;
  genres: { id: string; name: string }[];
  params: { genre?: string; condition?: string };
  products: CatalogProduct[];
}) {
  const chips = [
    params.genre && {
      key: "genre",
      label: params.genre,
      href: filterHref(basePath, params, { genre: undefined }),
    },
    params.condition && {
      key: "condition",
      label: params.condition,
      href: filterHref(basePath, params, { condition: undefined }),
    },
  ].filter(Boolean) as FilterChip[];

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold leading-[0.95] tracking-tight text-ink sm:text-4xl">
        {heading}
      </h1>

      <StockNav active={active} />

      <ActiveChips chips={chips} clearHref={basePath} />

      <div className="grid gap-8 md:grid-cols-[12rem_1fr]">
        <aside className="space-y-6 font-mono text-sm">
          <FilterGroup
            title="Genre"
            options={genres}
            active={params.genre}
            param="genre"
            basePath={basePath}
            current={params}
          />
          <ConditionFilter basePath={basePath} current={params} />
        </aside>

        <section>
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
        </section>
      </div>
    </div>
  );
}
