# Public site refinement (design touch-up, branch 1/3)

**Status:** branch `feature/public-refinement` — merged to `master` (2026-07-12).

A refinement-only pass over the public surface. No structural or color changes —
every token stays within DESIGN.md ("The Pirate Signal"). Verified live in the
browser at desktop; tests + build green.

## Changes
- **Whitespace / rhythm:** home section gap `space-y-16 → 20/24`, hero
  `pb-12 → 14`; stock rows `py-3 → py-4` with a full-bleed `hover:bg-surface`
  tonal-step (DESIGN.md §4); blog index rows `py-6 → py-8`, list gap
  `space-y-10 → 12`.
- **Typography:** tightened large-heading line-height to the DESIGN.md display
  (`0.95`) / headline (`1.1`) / title (`1.2`) values; widened all-caps mono
  tracking `0.04em → 0.06em` (badges, nav, metadata, kickers) and stock chips
  `0.03em → 0.05em`.
- **Hover:** unified every interactive hover to `transition … duration-150
  ease-out` (nav, footer links, buttons, chips, stock rows/cards, blog rows,
  social buttons, newsletter input). Added a `prefers-reduced-motion` collapse
  for the whole `.site-dark` surface in `globals.css`.
- **Blog index:** cleaner date/title/excerpt hierarchy — date column baseline
  aligned (`sm:pt-1.5`), title `leading-[1.2]`, excerpt `text-pretty
  leading-relaxed`, full-row hover. Reads as a curated log.
- **Blog excerpts (small logic change, TDD):** `postExcerpt` now strips the
  markdown subset the body uses (images, links→label, code, headings,
  blockquotes, emphasis) so a leading `![](/uploads/…)` no longer leaks raw into
  the listing — the function's own "plain-text excerpt" contract, now honored.

## Tests & verification
- 416 tests green (3 new: `postExcerpt` strips image/link/emphasis markdown).
  `tsc`, lint, `next build` clean.
- **Live browser check** (prod build, 1440px): home (tight display heading,
  wider signal kicker, section rhythm), stock (row breathing + hover tonal
  step confirmed), blog (clean hierarchy + prose excerpts, raw markdown gone).
- `/code-review low`: no Medium+; one documented Low (excerpt-only underscore
  stripping in bare words — acceptable lossy-preview tradeoff).

## Notes
- Mobile reflow logic (`flex-col` base → `sm:flex-row`) is structurally
  unchanged; only spacing tokens were touched. The Chrome device-emulation
  didn't re-render the screenshot viewport, so mobile was verified by the
  unchanged responsive classes rather than a mobile screenshot.
