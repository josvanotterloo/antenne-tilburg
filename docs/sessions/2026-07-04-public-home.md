# Session Log — 2026-07-04 (public Home)

## What was built
- `getLatestProducts` helper + the home page: hero with the genre-static motif, Just In
  (100 latest arrivals, no pagination), a 3-post blog teaser, and a visit panel.

## What worked
- TDD pinned the "100 latest" requirement (`getLatestProducts(100)`) and the section's
  links before styling.

## What drifted from intent
- First pass of the genre-static field overlapped the intro paragraph and buttons
  (busy). Fixed by making it a mask-faded top band behind the wordmark only — texture,
  not competing content.

## Signal (what should change in a shared artifact)
- [ ] None

## Updates made
- `lib/catalog` getLatestProducts (+test), `/` home page (+test), feature doc, this log.
