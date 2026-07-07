# Session Log — 2026-07-07 (header logo)

## What was built
- Added `public/logo.png` and swapped the `SiteHeader` text wordmark for the
  logo image (compact, `h-10` / 40px, width auto). TDD: header renders
  `<img src="/logo.png">`. Full close-out per branching.md.

## What worked
- TDD loop was clean: one failing test (no img) → minimal `<img>` → green.
- The required in-browser visual check caught a real defect before merge.

## What drifted from intent
- The spec asked for `mix-blend-multiply`. On the near-black canvas (`#0A0B0D`)
  with black-on-white logo art, multiply drops the white bg but also renders the
  black artwork invisible — verified in-browser. Delivered the intent (visible
  logo, bg dropped) with `invert mix-blend-screen` instead, and documented why.

## Signal (what should change in a shared artifact)
- [x] Failure: a blend-mode instruction that assumes a light backdrop can fail
  silently (invisible element) on the dark canvas. The visual-check step in
  branching.md is what caught it — worth keeping mandatory for any CSS blend/
  filter work.

## Friction points
- Logo source was `~/Downloads/antenne.png` (JPEG data, `.png` name), not yet in
  `public/`; copied it to `public/logo.png`. A second dev server couldn't bind
  (Next 16 refuses two) — used the already-running one on :3000, same repo dir.

## Updates made
- `public/logo.png`, `components/layout/SiteHeader.tsx`,
  `components/layout/SiteHeader.test.tsx`, `docs/features/header-logo.md`,
  this log.
