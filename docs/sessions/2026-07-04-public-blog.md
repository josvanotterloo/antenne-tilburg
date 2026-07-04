# Session Log — 2026-07-04

## What was built
- Installed the `impeccable` design plugin and ran `/impeccable init` → `PRODUCT.md`,
  `DESIGN.md` ("The Pirate Signal"), `.impeccable/design.json`. Merged on
  `feature/design-system-init`.
- Changed the accent to `#6B7DC9` across all three design docs (contrast-checked:
  ~5.1:1 on canvas, clears WCAG AA → collapsed the two-tier signal into one token).
- `feature/public-blog`: wired the design tokens/fonts and restyled the public chrome,
  then built the blog query layer, `/blog` index, `/blog/[slug]` detail, and seeded
  sample posts. TDD throughout; commit per logical unit.

## What worked
- Pulling the identity straight from the live antenne-tilburg.nl (black + monospace +
  antenna/genre-static) gave a strong, ownable DESIGN.md instead of generic minimalism.
- Scoping brand base styles to `.site-dark` kept the light admin surface untouched
  while the public site went black — no admin regressions, all 187 prior tests stayed green.
- TDD caught a bad test assertion (excerpt regex) before it hid in the suite.

## What drifted from intent
- `/impeccable` wasn't installed at first; had to install the plugin mid-flow. The
  `Skill` tool doesn't see freshly installed plugins until a Claude Code restart, so
  the skill was run manually from the plugin cache.

## Signal (what should change in a shared artifact)
- [x] Workflow: prefer concrete drafts over long AskUserQuestion batteries (see below).

## Friction points
- Opened the design interview with big multi-question AskUserQuestion menus; the user
  rejected them twice and instead gave a one-line directive + a reference site. A better
  first move: inspect the reference, then present a concrete DESIGN.md draft to react to.

## Updates made
- `PRODUCT.md`, `DESIGN.md`, `.impeccable/design.json`, public design foundation,
  `lib/blog.ts`, `/blog` + `/blog/[slug]`, `prisma/seed.ts`, feature doc, this log,
  a `tasks/lessons.md` row, and two memory files.
