# Clickable artist + label

**Status:** branch `feature/clickable-artist-label` — merged to `master` (2026-07-06).

## Summary
Artist and label are now links on the `/stock` listing and `/stock/[id]` detail — click
an artist to see everything by them, a label to see everything on it.

## What changed
- **`lib/catalog.ts`:** `buildCatalogWhere` gains an `artist` filter
  (`{ equals, mode: "insensitive" }`); `CatalogQuery.artist` is threaded through
  `getCatalogPage`. Added `stockArtistHref` / `stockLabelHref` (fresh, single-facet
  `/stock?artist=` / `/stock?label=` URLs).
- **`/stock` page:** now honors `?artist=` and re-enables `?label=` (resolved name → id),
  shown as removable chips and preserved by the search form. Sidebar facets stay Genre +
  Condition; product type / just_in params remain ignored. Rows and cards were
  restructured into **separate links** (artist → filter, title/price → detail, label →
  filter) so no anchors are nested.
- **`/stock/[id]` detail:** artist (header + Artist row) and label (meta line + Label
  row) link to the filtered views.

## Tests & verification
- Unit tests (260 total green): `buildCatalogWhere` case-insensitive artist filter; the
  page honors artist + label but not type/just_in; rows and detail render the artist/
  label filter links with the right hrefs.
- **Live:** `/stock?artist=Biosphere` → 1 result + "BIOSPHERE ×" chip; clicking a
  product's label navigated to `/stock?label=Dirty%20Carpets` with a "DIRTY CARPETS ×"
  chip and the filtered result.

## Note
This intentionally re-enables the **label** query param that the earlier
`public-surface-trim` ignored — label is now a click-through filter (not a sidebar
facet). Product type stays internal.
