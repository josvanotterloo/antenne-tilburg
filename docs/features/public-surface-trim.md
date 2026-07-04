# Public surface trim

**Status:** branch `feature/public-surface-trim` (commits `4a11969`, `701e730`) —
merged to `master` (2026-07-04). Feedback-driven adjustments to already-shipped
public pages.

## Changes
1. **Events removed from the public site.** Deleted `/events` and `/events/[slug]`
   pages, dropped `Events` from the public nav (`SiteHeader`) and from `sitemap.ts`,
   removed the home events teaser, and adjusted blog subtitle copy. The **admin
   events section is untouched** and kept for internal use.
2. **`/stock` public filters restricted to Genre + Condition.** Removed the Label and
   Product Type facet groups and the "Just In" quick-filter from the public filter
   bar. `label` / `type` / `just_in` query params are now ignored on the public page.
   Search, sort, and the list/grid toggle are unchanged. The product "Just In" badge
   (30-day) is unchanged. Admin catalog still exposes all filters (`lib/catalog.ts`
   is shared and untouched).

## Deferred (spec captured, built later)
- **Home "Just In" = 100 latest arrivals by `createdAt DESC`** (no 30-day window, no
  pagination). This is a Home-page requirement; Home is built last in the public-page
  sequence, so it lands there.

## Tests & verification
- `/stock` page tests extended: asserts Label / Product Type / Just-In quick-filter
  are not rendered, that Genre + Condition are, and that label/type/just_in params
  don't reach `getCatalogPage`. 207 tests green; `tsc` + lint clean.
- **Live:** `/stock` shows only Genre + Condition facets; nav has no Events;
  `/events` → 404.

## Known gaps
- `/stock` predates `DESIGN.md`: it renders on the black canvas but its internal
  styling (neutral text, amber "Just In" badge) is not yet on-brand. A `/stock`
  restyle to the design system is a separate follow-up, not part of this trim.
