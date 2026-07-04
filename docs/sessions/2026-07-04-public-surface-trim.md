# Session Log — 2026-07-04 (public surface trim)

## What was built
- Removed events from the public site (pages, nav, sitemap, home teaser); kept admin
  events for internal use.
- Restricted `/stock` public filters to Genre + Condition (removed Label, Product
  Type, and the Just In quick-filter); label/type/just_in params now ignored. TDD.
- Captured the Home "Just In = 100 latest by createdAt" spec for the Home build.

## What worked
- TDD on the `/stock` restriction: wrote assertions that the removed facets don't
  render and the dropped params don't reach `getCatalogPage`, watched them fail, then
  trimmed. Caught nothing broken elsewhere (207 green).

## What drifted from intent
- Visual check surfaced that `/stock` is half-on-brand: it inherited the black canvas
  from the design foundation but its internal styling predates DESIGN.md (neutral
  text, amber Just-In badge). Flagged to the user as a separate follow-up rather than
  expanding this trim's scope.

## Signal (what should change in a shared artifact)
- [x] Failure: making the public `<body>` black in the foundation left pre-existing
  pages (`/stock`, home placeholder) visually half-styled until each is restyled.
  Worth restyling or explicitly scheduling every pre-existing public page when a
  global theme flips.

## Friction points
- Two stray `next dev` servers collided (a leftover on :3000 plus a new one on :3002),
  producing a false "error page" on first screenshot. Killed all, started one clean.

## Updates made
- Deleted public events pages; `SiteHeader`, `sitemap.ts`, home, blog copy;
  `/stock` page + tests; feature doc; this log.
