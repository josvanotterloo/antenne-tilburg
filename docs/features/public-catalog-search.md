# Public catalog & search

**Status:** Merged to `master` (2026-07-03) · branch
`feature/public-catalog-search` (commits `966e7f2`, `fb1a541`, `123a611`,
`e658e7e`, `22d4c3a`, `f79545a`, `2486761`, `8a51c1c`, `60606cb`)

## Summary
Server-side-only catalog: full-text search, filtering, sorting and pagination
that scale to tens of thousands of records (the browser never loads the full
catalog). Adds the public `/stock` listing, product detail, an RSS feed, and
brings the same shared query logic to `/admin/catalog`.

## What's in place
- **DB (`prisma/schema.prisma` + migration `catalog_search`):** btree indexes
  on `condition`, `inStock`, `createdAt` (labelId/genreId/productTypeId already
  indexed); a generated `search_vector tsvector` over artist+title+description
  with a GIN index (`product_search_idx`). Declared `Unsupported("tsvector")`
  so Prisma sees it without drift.
- **`lib/catalog.ts` (shared by /stock and /admin):** `buildCatalogWhere`,
  `buildCatalogOrderBy`, `parsePage`/`pageToSkip`/`pageCount`,
  `catalogPageNumbers` (windowed pagination), `isJustIn`, `searchProductIds`
  (raw GIN-indexed `websearch_to_tsquery`), and `getCatalogPage` — runs the
  filtered query and count in parallel, always bounded by take/skip.
- **`/stock`:** URL-state filters (genre/label/type/condition/just_in) resolved
  by name → indexed FK id, removable chips, sort (date/artist/label), list/grid
  toggle, windowed pagination, full-text search combined with filters;
  `inStock = true` only.
- **`/stock/[id]`:** all fields + relations, Just In badge, `generateMetadata`,
  404 when missing or out of stock.
- **`/stock/feed.xml`:** RSS of the last 50 in-stock arrivals, XML-escaped.
- **`/admin/catalog`:** now uses `getCatalogPage` — `?q=` search + pagination +
  total count (replaces the previous unbounded findMany); shows all products.

## Confirmed design decisions
- **FTS wiring:** `buildCatalogWhere` returns a Prisma `where`; when `q` is set,
  `searchProductIds` returns matching ids injected as `{ id: { in: ids } }`.
  FTS is a filter, not a sort. (The tradeoff: matched ids are materialised in
  JS — fine for tens of thousands, especially with filters narrowing results.)
- **Filter URL keys** are reference names resolved to the indexed FK id;
  unknown name → empty result set.
- Public visibility = in-stock only; admin sees all (`onlyInStock` flag).

## Tests & verification
- **86 unit tests** (Vitest): where/orderBy/paging/window/isJustIn,
  searchProductIds + getCatalogPage (q passthrough, no-q, pagination), /stock
  render + q + in-stock, detail 404 cases, RSS shape/escaping, admin search.
- `tsc`/`lint`/`build` clean.
- **Live end-to-end against real Postgres:** `?q=techno` → Torus only;
  `?q=house` → Can You Feel It (matched via description); `?genre=Ambient` →
  Substrata; detail 200/404; RSS valid.

## Code-review fixes (`60606cb`)
- Pagination rendered a link per page (200+ at scale) → `catalogPageNumbers`
  windowed helper with ellipsis, used by both listings.
- `/stock` search form dropped an active Just In filter → added the hidden
  input.

## Known gaps / not done
- Detail page issues two identical `findUnique` queries (metadata + body);
  minor, not wrapped in `React.cache()` to avoid cross-test memoization.
- No cover-image rendering yet (schema has `coverImage`, UI omits it).
- FTS is unranked (results ordered by the chosen sort, not relevance) — by
  design, since sorts are date/artist/label.
