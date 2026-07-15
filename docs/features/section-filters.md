# Genre/condition filters on the stock section pages

The /stock sidebar (Genre + Condition) and removable filter chips now render
on /stock/this-week, /stock/last-week and /stock/back-in-stock. Filter
clicks stay on the section's own path (`/stock/this-week?genre=Techno`
shows only techno added this week); chips remove one filter, Clear all
returns to the unfiltered section.

## Queries

`getThisWeekProducts` / `getLastWeekProducts` / `getBackInStockProducts`
take a `SectionFilters` options object — `{ genreId, condition, now }` —
composing `buildCatalogWhere`, so filter semantics match `getCatalogPage`
exactly (including the `NONE` sentinel for unknown filter names). This was
a signature migration from the positional `now` argument; the feed route's
no-arg call is unaffected.

## Shared filter UI (`components/stock/StockFilters.tsx`)

Extracted from /stock and parameterized by `basePath`: `FilterGroup`,
`ConditionFilter`, `ActiveChips`, `filterHref`, `resolveFilterId`,
`parseCondition`, `one`, plus the shared link/label class constants.
/stock consumes the same module — its test file stayed green unchanged
through the refactor. `SectionPage` gained `basePath`/`genres`/`params`
props and renders the sidebar grid layout used by /stock.

## Tests

- lib: each query passes genre/condition into the where clause alongside
  its own window/quantity clauses (per-function tests).
- Pages: `?genre=&condition=` resolve to ids and reach the query; sidebar
  renders with section-scoped hrefs; chips + Clear all appear when filters
  are active (×3 pages via describe.each).

Verified against the dev DB: back-in-stock filtered by genre, condition,
and both (empty state) rendered the correct subsets.
