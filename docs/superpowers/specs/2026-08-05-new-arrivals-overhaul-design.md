# Design: Public Stock/Catalog Overhaul ("New Arrivals")

Date: 2026-08-05

## Summary

Simplify the public `/stock` section from a full filterable/searchable/paginated
catalog into a plain "New Arrivals" list: the last 100 in-stock products,
newest first, no filters, no search, no pagination, no price, no clickable
artist/label links. The three weekly sub-sections (This Week / Last Week /
Back In Stock) are removed entirely. The admin catalog is untouched — it keeps
its own filtering, search, and pagination via the shared `lib/catalog.ts`
query layer.

The URL stays `/stock`. A new `/new-arrivals` route redirects to it, so the
new name works today even though the path doesn't change yet.

## Rename: "Stock" → "New Arrivals"

- `components/layout/SiteHeader.tsx:8` — nav label `"Stock"` → `"New Arrivals"`
  (href stays `/stock`)
- `components/layout/SiteFooter.tsx:8` — same rename in the footer navigate
  column
- `app/(public)/stock/page.tsx` — `metadata.title` and page `<h1>` become
  "New Arrivals"
- `app/sitemap.ts` — drop `/stock/this-week`, `/stock/last-week`,
  `/stock/back-in-stock` from `STATIC_ROUTES` (they now 404)
- New `app/(public)/new-arrivals/page.tsx` — server component calling Next's
  `redirect("/stock")`

## Data layer (`lib/catalog.ts`)

- **Reused as-is:** `getLatestProducts(limit = 100)` already does exactly
  "last 100, `inStock: true`, `createdAt desc`, includes `CATALOG_INCLUDE`" —
  it's the function the home page's "Just In" section already calls.
  `/stock/page.tsx` switches to calling this instead of `getCatalogPage`.
  `/stock/feed.xml` switches to calling this instead of its own inline
  `db.product.findMany` query (which took 50 — this bumps the feed to 100 to
  match the page).
- **Deleted** (confirmed unused outside the pages being removed):
  - `getThisWeekProducts`, `getLastWeekProducts`, `getBackInStockProducts`
  - `stockArtistHref`, `stockLabelHref`
  - Any `buildCatalogWhere`/pagination/search plumbing that is *only*
    reachable from the deleted public filter/search/pagination UI
- **Untouched** (admin depends on these via `app/admin/catalog/page.tsx` and
  `app/api/catalog/route.ts`): `getCatalogPage`, `buildCatalogWhere`,
  `CATALOG_INCLUDE`, `isRestock`, `isJustIn`

## `/stock` page rewrite (`app/(public)/stock/page.tsx`)

Becomes a plain server component: fetch `getLatestProducts()`, render a flat
list using the existing `ProductRow` (list view only — the grid `ProductCard`
is deleted). No `searchParams` handling, no `StockNav`, no filter sidebar, no
sort controls, no search form, no pagination.

## Full deletions

- `components/stock/StockNav.tsx` + `components/stock/StockNav.test.tsx`
- `components/stock/StockFilters.tsx`
- `app/(public)/stock/SectionPage.tsx`
- `app/(public)/stock/this-week/`, `last-week/`, `back-in-stock/` (pages +
  their tests: `sections.test.tsx` and similar)
- `app/(public)/stock/back-in-stock/feed.xml/route.ts` + its test
  (`back-in-stock/feed.test.ts`)
- The grid `ProductCard` function inside `stock/page.tsx`

## Price removal

Removed from every public render path, and from structured data too (no
price anywhere, visible or machine-readable):

- `components/stock/ProductRow.tsx` — drop the price `<dd>`/span
- `app/(public)/stock/[id]/page.tsx` — drop the price `<dd>`
- `app/(public)/page.tsx` `JustInRow` (home "Just In" section) — drop price
- `lib/structured-data.ts` — drop the `Offer`/`price`/`priceCurrency` block
  from the Product JSON-LD entirely

Price is untouched in the database, Prisma schema, and admin UI.

## Artist/label as plain text

- `ProductRow.tsx`, `stock/[id]/page.tsx` — replace
  `<Link href={stockArtistHref/stockLabelHref}>` with plain text (same
  typography/styling, no anchor)
- `stock/page.tsx` — remove `sp.artist`/`sp.label` query-param parsing (no
  filters left to drive with them)

## Testing

- **Update:** `app/(public)/stock/page.test.tsx` (assert exactly last-100
  in-stock products, no filters/search/pagination/price/links),
  `app/(public)/stock/[id]/detail.test.tsx` (no price, plain-text
  artist/label), `app/(public)/page.test.tsx` (home, no price in Just In),
  `app/(public)/stock/feed.xml/feed.test.ts` (100 items via
  `getLatestProducts`), `lib/structured-data.test.ts` (no price field),
  `app/sitemap.test.ts` (3 fewer static routes), `lib/catalog.test.ts`
  (remove specs for deleted functions only)
- **Delete:** `components/stock/StockNav.test.tsx`,
  `app/(public)/stock/sections.test.tsx`,
  `app/(public)/stock/back-in-stock/feed.test.ts`
- **Unchanged:** `features/catalog-filter.feature`,
  `features/stock-search.feature`, `features/restock-detection.feature` — all
  exercise `getCatalogPage`/badge logic directly (which admin still uses),
  not the `/stock` UI, so they remain valid without modification
- **New:**
  - 404 coverage for `/stock/this-week`, `/stock/last-week`,
    `/stock/back-in-stock`, `/stock/back-in-stock/feed.xml`
  - Redirect test for `/new-arrivals` → `/stock`

## Out of scope

- Prisma schema / database — untouched
- Admin catalog page, admin API routes — untouched
- Moving the canonical URL from `/stock` to `/new-arrivals` — not part of
  this change; only the redirect exists
