# Header logo

**Status:** branch `feature/header-logo` — merged to `master` (2026-07-07).

## Summary
Replace the text wordmark in `SiteHeader` with the Antenne logo image
(`public/logo.png`), sized compactly for the nav.

## What's in place
- **`public/logo.png`:** the Antenne logo (black `antenne` wordmark + antenna
  graphic + address line on a white background; 413×296).
- **`components/layout/SiteHeader.tsx`:** the home `Link` now wraps a plain
  `<img src="/logo.png" alt="Antenne Tilburg">` (alt carries the brand name the
  old text wordmark provided). Constrained to `h-10` (40px) with `w-auto` to
  preserve aspect ratio — a compact header logo, not a hero image.

## Blend mode — why `invert mix-blend-screen`, not `mix-blend-multiply`
The task asked for `mix-blend-multiply` to drop the white background. That works
when the backdrop is light, but the header canvas is near-black (`#0A0B0D`) and
the logo art is **black on white**. On a dark backdrop, multiply drops the white
bg *and* keeps the black artwork black → the whole logo renders invisible
(confirmed in-browser).

Fix: **`invert`** flips the asset (art → white, bg → black), then
**`mix-blend-screen`** composites it — the white art screens to white (visible)
and the black bg screens to the canvas colour (drops out). Result: a white logo
on the dark header with no visible background rectangle.

## Tests & verification
- **1 new test** (`components/layout/SiteHeader.test.tsx`, 285 total green): the
  header renders an `<img>` with `src="/logo.png"` and an accessible name. TDD —
  test written and watched fail before the img existed.
- `lint` clean (0 errors). **Live check:** rendered `/` in-browser before and
  after — multiply → invisible logo; invert+screen → white logo, bg dropped.
