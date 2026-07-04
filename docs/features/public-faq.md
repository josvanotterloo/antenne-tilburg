# Public FAQ page

**Status:** branch `feature/public-faq` — merged to `master` (2026-07-04).

## Summary
`/faq` — six Q&As answering the questions from the project plan, rendered as visible
content and as `FAQPage` structured data for SEO.

## What's in place
- **`/faq`:** a `<dl>` of hairline-separated Q&As (question in Space Grotesk, answer in
  muted ink), 72ch column, closing link to `/visit`. Covers: vinyl/tape only, the
  second-hand section, Discogs stock vs the in-store racks, next-day pickup (no
  shipping), holds/reservations, and location/hours.
- **SEO:** an `application/ld+json` `FAQPage` block generated from the same `FAQ_ITEMS`
  array, so the answers are crawlable and eligible for rich results. The single source
  of truth drives both the visible list and the structured data.

## Tests & verification
- Asserts the FAQ heading, the core themes (vinyl and tape, second-hand, Discogs,
  pickup), and that a `script[type="application/ld+json"]` containing `FAQPage` +
  `Discogs` is emitted. 223 tests green; `tsc` + lint clean.
- **Live:** renders as a clean Q&A list on the black canvas.
