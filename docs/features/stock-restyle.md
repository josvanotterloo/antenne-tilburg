# /stock restyle + two follow-up fixes

**Status:** branch `feature/stock-restyle` — merged to `master` (2026-07-04).

## Summary
Brings the pre-`DESIGN.md` catalog pages fully on-brand, and clears two minor issues
flagged during the public-pages build.

## /stock restyle (listing + detail)
`app/(public)/stock/page.tsx` and `app/(public)/stock/[id]/page.tsx` restyled to
DESIGN.md — logic untouched, so the 7 `/stock` tests stay green:
- **Black canvas**, no more light-neutral classes or the amber "Just In" badge.
- **Typography split:** JetBrains Mono for catalog data (prices, catalog no., meta
  lines, filter lists, sort controls, pagination, badges); Space Grotesk for headings.
- **`#6B7DC9` signal accent:** "Just In" badges, active sort/filter underline,
  current pagination cell, input focus.
- **Hairlines, zero radius, no shadows:** hairline row dividers on the list and the
  detail definition-list, hairline-bordered grid cards and filter/pagination controls.
- Filter selection is shown by a signal underline (not colour alone).

## Fix — footer opening hours Monday-first
`SiteFooter` now uses the shared `orderOpeningHours` + `formatHourRange` + `DAY_NAMES`
helpers (drops its local `DAYS` array and inline formatting), so it reads hours
Monday-first like the Visit page. Covered by a new `SiteFooter.test.tsx`.

## Fix (documented, not applied) — blog [slug] double query
The clean dedup for the two identical slug lookups is `React.cache()`, a **React 19**
API; this project is on **React 18.3.1**, where `react` exports no `cache` (verified:
`typeof require("react").cache === "undefined"`). Attempting it fails at module load.
Left as-is (a cheap, indexed unique lookup) with a note at the call site — matching the
same accepted decision in `/stock/[id]`. Revisit if/when the project moves to React 19.

## Tests & verification
- 244 tests green (added `SiteFooter` Monday-first + format tests); `tsc` + lint clean.
- **Live:** `/stock` list, grid and `/stock/[id]` detail all render on the black canvas
  with mono catalog data, signal accents and hairlines; footer is Monday-first.

## Resolves
The "/stock predates DESIGN.md" known gap noted in `public-surface-trim.md`.
