# Search bar on all stock pages

The StockNav search slot now always renders:

- `/stock` passes its own filter-preserving form as the slot's children —
  unchanged behavior.
- `/stock/this-week`, `/stock/last-week` and `/stock/back-in-stock` fall
  back to StockNav's built-in `DefaultSearchForm`: a plain GET form with
  `action="/stock"` and the `q` input, so submitting a search from a
  section lands on `/stock?q=<term>` where full search is supported.
  Active section filters (genre/condition) are deliberately not carried
  along — the user asked to search, /stock starts them clean.

## Interface change (Test Contract)

The sections test "has no search input — filtering lives on /stock only"
asserted the old interface and was inverted to assert the form targets
`/stock`. Explicitly requested by Jos (2026-07-16), so the change is
approved per CLAUDE.md ## Test Contract rule 3/4.

## Tests

- StockNav: default form renders with `name="q"` and `action="/stock"`
  when no slot children are given; the provided-slot behavior unchanged.
- Section pages (×3): searchbox present, form submits to `/stock`.

Verified against the dev server: all four pages render the form;
`/stock?q=vril` returns the expected record.
