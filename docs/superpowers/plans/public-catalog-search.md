# Plan — Public catalog & search

Branch: `feature/public-catalog-search`. Server-side-only filtering / sorting /
pagination / search; the catalog may reach tens of thousands of rows, so never
load the full set client-side. Strict TDD; commit per unit.

## Confirmed decisions
- **FTS wiring:** `buildCatalogWhere` returns a Prisma `where`. When `q` is set,
  a raw indexed query (`search_vector @@ websearch_to_tsquery('english', q)`)
  returns matching ids, injected as `{ id: { in: ids } }`. FTS is a *filter*,
  not a sort (sorts are date/artist/label).
- **Filter URL keys:** `?genre=techno&label=tresor` are reference **names**,
  resolved to the indexed FK id (case-insensitive unique lookup) before query.
  Unknown name → empty result set.
- **Search fn:** `websearch_to_tsquery('english', q)`.
- **Public visibility:** `/stock` list + detail show `inStock = true` only;
  out-of-stock → 404 on detail. Admin shows all (`onlyInStock` flag).
- **Detail route:** `/stock/[id]` (products have no slug).
- Indexes `labelId`/`genreId`/`productTypeId` already exist → add only
  `condition`, `inStock`, `createdAt`.

## Units (commit after each)
0. **DB layer** — schema: 3 new `@@index`, `search_vector Unsupported("tsvector")?`.
   One migration adding the btree indexes + the generated tsvector column +
   GIN index (`product_search_idx`). Apply + verify FTS matches for real.
1. **`lib/catalog.ts`** (pure + one raw helper) — `JUST_IN_DAYS=30`,
   `PAGE_SIZE=50`, `buildCatalogWhere(params)`, `buildCatalogOrderBy(sort,order)`,
   `pageToSkip(page)`, `searchProductIds(q)`. TDD: where per filter combo,
   orderBy per sort, pagination math.
2. **`/stock`** — server component; parse searchParams → resolve filter ids →
   (q?) searchProductIds → `Promise.all([findMany{take,skip,include}, count])`.
   Removable filter chips, sort, list/grid via `?view=grid`, prev/next + page
   numbers. TDD: renders with mocked DB; `?q=` passes the term.
3. **`/stock/[id]`** — server detail; all fields + relations; Just In badge;
   `generateMetadata`; 404 if missing or `inStock=false`. TDD: 404 cases.
4. **`/stock/feed.xml`** — route handler; last 50 arrivals; `artist — title`,
   label, genre, price, link.
5. **Admin `/admin/catalog`** — reuse `lib/catalog`; add `?q=` + pagination +
   total count (replaces the current unbounded findMany).

## Done = 
All required tests green via run-tests skill; `tsc`/`lint`/`build` clean; FTS
verified against real Postgres; branching.md close-out.
