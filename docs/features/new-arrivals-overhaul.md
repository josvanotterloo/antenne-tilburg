# New Arrivals overhaul

**Status:** Merged to `master` (2026-08-05) · branch `feature/new-arrivals-overhaul`

Spec: `docs/superpowers/specs/2026-08-05-new-arrivals-overhaul-design.md`
Plan: `docs/superpowers/plans/2026-08-05-new-arrivals-overhaul.md`

## Summary

Simplified the public `/stock` catalog from a full filterable/searchable/
paginated/sortable listing into a plain "New Arrivals" list — the last 100
in-stock products, newest first, no price, no clickable artist/label links.
The three weekly sub-sections (This Week / Last Week / Back In Stock) and
their RSS feed are gone entirely. Admin is untouched.

## What changed

- **Rename:** "Stock" → "New Arrivals" in nav, footer, `/stock` heading and
  `<title>`, and public copy that echoed the section name (home hero CTA,
  Just In section link, empty-state link, detail-page back-link). The URL
  stays `/stock`; a new `/new-arrivals` route redirects to it.
- **`/stock` simplified:** now fetches via `getLatestProducts()` (the same
  function the home page's Just In section already used) — last 100,
  `inStock: true`, `createdAt` DESC. No filter sidebar, search box, sort
  controls, pagination, or grid view. JUST IN / RESTOCK badges preserved.
- **Deleted:** `/stock/this-week`, `/stock/last-week`, `/stock/back-in-stock`
  pages, `/stock/back-in-stock/feed.xml`, `StockNav`, `StockFilters`,
  `SectionPage`, and their now-dead `lib/catalog.ts` exports
  (`getThisWeekProducts`, `getLastWeekProducts`, `getBackInStockProducts`,
  `stockArtistHref`, `stockLabelHref`, `SectionFilters`,
  `BACK_IN_STOCK_DAYS`). These four routes now 404 by design (no redirect —
  nothing was linking to them).
- **Price removed from every public surface:** `/stock` rows, `/stock/[id]`,
  home Just In, Product JSON-LD (`lib/structured-data.ts`), the
  `/stock/feed.xml` RSS description, and the public `/api/catalog` JSON
  endpoint. Price stays in the DB, Prisma schema, and admin
  (`/admin/catalog`, `/api/catalog` is unauthenticated but public — it lost
  price too, see below).
- **Artist/label as plain text:** no more clickable filter links on any
  public page; `?artist=`/`?label=` query-param filtering is gone.
- **`/stock/feed.xml`:** switched from its own inline `take: 50` query to
  `getLatestProducts()` (100), matching the page exactly.

## Mid-execution corrections (things the original spec got wrong)

Both surfaced during implementation, not planning — recorded here since
they're the kind of gap worth watching for next time a "remove X from every
public surface" branch runs:

1. **`features/restock-detection.feature`** was assumed to only test the
   `isRestock` badge predicate (which survives). It actually called
   `getBackInStockProducts()` directly — the deleted "Back In Stock section"
   query — so it was deleted alongside it. `isRestock`'s own coverage is
   untouched in `lib/catalog.test.ts`.
2. **`app/api/catalog/route.ts`**, a public unauthenticated JSON endpoint
   for AI shopping agents / discoverability, still returned `price`/
   `currency` after every HTML surface had it removed — caught by the final
   whole-branch review, confirmed with the project owner, fixed.

## Explicitly out of scope / deliberate

- No redirects for the deleted weekly-section routes — confirmed with the
  project owner that nothing currently links to them, so a hard 404 is
  fine.
- `lib/catalog.ts`'s general-purpose filter/sort capability (`artistIds`,
  `labelId`, `productTypeId`, `justIn`, artist/label sort orders) was **not**
  deleted even though nothing currently calls it that way — it's shared
  library surface for admin/API consumers, documented with a comment
  instead (`lib/catalog.ts` near `CatalogFilters`) rather than removed.
- No schema/database changes. No admin UI changes.

## Superseded docs

`docs/features/stock-nav.md`, `section-filters.md`, `stock-week-sections.md`,
`search-on-sections.md`, `clickable-artist-label.md` (fully superseded),
`restock-badge.md`, `public-catalog-search.md`, `acceptance-tests.md`
(partially — sections marked inline).
