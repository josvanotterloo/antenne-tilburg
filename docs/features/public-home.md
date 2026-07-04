# Public Home page

**Status:** branch `feature/public-home` — merged to `master` (2026-07-04). Final page
of the public-site build.

## Summary
`/` — the front door: a hero carrying the "Pirate Signal" identity, a Just In section
of the 100 latest arrivals, a blog teaser, and a visit panel.

## What's in place
- **`lib/catalog.ts` → `getLatestProducts(limit = 100)`:** newest-first, in-stock only,
  with the shared catalog include. Tested.
- **Hero:** the genre-static motif (a faint, mask-faded field of genre words behind the
  "Antenne Recordshop" wordmark — texture, `aria-hidden`), a signal tagline, intro, and
  Browse-stock / Plan-your-visit CTAs.
- **Just In:** the 100 latest arrivals (`createdAt` desc, **no pagination**, per the
  brief) in a two-column list, each row linking to `/stock/[id]` with a "New" badge for
  in-window arrivals and an "All stock →" link. Empty-state when the catalogue is bare.
- **From the blog:** the 3 latest published posts (mono date + title), "All posts →".
- **Visit panel:** address + a link to `/visit`.

## Design decisions
- The Just In "New" badge still uses the 30-day `isJustIn` window; the *section* is the
  100-latest list. Two different signals, deliberately (the home section is recency; the
  badge is "arrived recently").
- The genre-static field is static (mask-faded), honouring DESIGN.md's motif without a
  motion dependency; it's `aria-hidden` texture, never essential content.

## Tests & verification
- **7 tests** (242 total green): `getLatestProducts` (in-stock, newest-first, limit +
  default); home renders Just In linking to products, requests 100, teases blog posts
  linking to each, links to stock/blog/visit, and survives an empty catalogue. `tsc` +
  lint clean.
- **Live:** hero, Just In grid with prices + New badges, blog teaser and visit panel all
  render on the black canvas; the static reads as texture behind the wordmark.
