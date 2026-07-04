# Public About page

**Status:** branch `feature/public-about` — merged to `master` (2026-07-04).

## Summary
`/about` — editorial content page telling the shop's story, plus a footer "Explore"
nav so the info pages are reachable.

## What's in place
- **`/about`:** static prose in a 72ch column (Space Grotesk headings, ink body) —
  lead, "What we stock" (electronic focus + genres + labels), "The second-hand
  section", "On Discogs" (independent stock, next-day pickup), and closing links to
  `/visit` and `/stock`. Content grounded in the project plan.
- **`SiteFooter`:** gained a third "Explore" column (Stock, Blog, Visit, About, FAQ,
  Newsletter). The header stays lean (Home/Stock/Blog/Visit); the footer carries the
  secondary/info links so About/FAQ/Newsletter are navigable, not URL-only.

## Tests & verification
- Content smoke tests assert the About heading and required themes (DJ DMDN,
  electronic, Sam-Sam, second-hand, Discogs, pickup). Recurring keywords use
  `getAllByText` to stay non-brittle. 220 tests green; `tsc` + lint clean.
- **Live:** About renders as clean editorial prose; footer shows the 3-column layout
  with the Explore links.

## Notes
- About is a static content page, so "TDD" here is a structure/smoke test documenting
  required content rather than logic coverage.
