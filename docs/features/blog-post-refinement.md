# Blog post page refinement (design touch-up, branch 2/3)

**Status:** branch `feature/blog-post-refinement` — merged to `master` (2026-07-12).

Reading-experience refinement of `/blog/[slug]`. Styling only — no logic, no DOM
reorder. Verified live in the browser.

## Decision
The brief said "cover image should have a subtle bottom margin *before the
title*," which implied a cover-above-title layout — but the current order is
date → title → cover → body, and the brief also said no structural changes.
Asked the user; they chose **keep the current order**. So the cover stays after
the header with clean spacing to the body, and the hierarchy was refined in
place.

## Changes
- **Post body breathing room** (`components/PostBody.tsx`): paragraph
  line-height `relaxed → 1.7` (DESIGN.md body 1.6 + 0.1 for light-on-dark, per
  brand guidance); block spacing `space-y-4 → space-y-6`; heading top padding
  `h2 pt-4 → pt-6`, `h3 pt-2 → pt-4` with tightened heading leading — asymmetric
  rhythm so each heading belongs to the content below it.
- **Date / title hierarchy** (`page.tsx`): date stays small + muted mono (kicker
  tracking `0.04em → 0.06em`); title gains `leading-[1.05]` to read commanding.
- **Cover spacing:** article `space-y-8 → space-y-10`, giving the cover ~40px of
  clean separation from the body below.
- **Mobile reading inset:** article `px-2 sm:px-0` — extra horizontal padding on
  phones (on top of the layout's `px-4`) so the column doesn't hug the edges.
  The 72ch measure is unchanged.
- Consistency with branch 1: back-link + body links use `transition …
  duration-150 ease-out`.

## Tests & verification
- 416 tests green (no new — styling only; the blog detail test has no class
  assertions). `tsc`, lint, `next build` clean.
- The test gate caught an invalid top-level JSX comment (`{/* */}` right after
  `return (`) during development; fixed to a JS comment above the return.
- **Live browser check** (prod build, 1440px): commanding date/title hierarchy,
  cover spacing, comfortable 1.7 prose with clear paragraph separation. Mobile
  inset verified by the responsive class (Chrome emulation didn't re-render the
  screenshot viewport).
- `/code-review low`: no findings.
