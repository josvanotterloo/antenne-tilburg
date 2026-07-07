# React 19 upgrade

**Status:** branch `feature/react-19` — merged to `master` (2026-07-07).

## Summary
Upgraded React 18.3.1 → 19, then used the now-available `React.cache()` to remove the
long-standing double queries on the two detail pages.

## Pre-flight assessment (before touching code)
- **Client components:** 18 total. Grepped every React-19 breaking pattern —
  `forwardRef`, `ReactDOM.render`/`react-dom/client`, `defaultProps`, `propTypes`,
  string refs, argument-less `useRef()` — and found **none**. So no client-component
  changes were expected (and none were needed).
- **Dependencies:** Next 16.2, `@testing-library/react` 16.3, `react-markdown` 10,
  `@vitejs/plugin-react` 6 all already support React 19. `next-auth` v4 declares a
  `react ^18` peer, so 19 triggers a peer **warning** — but it resolves (deduped to
  react@19) and runs fine (only `signIn`/`signOut` are used).

## What changed
- `react` / `react-dom` → 19.2.7; `@types/react` / `@types/react-dom` → 19.
- **`React.cache()` dedup:** `/blog/[slug]` (`getPost = cache(getPublishedPostBySlug)`)
  and `/stock/[id]` (`getProduct = cache(...)`) — `generateMetadata` and the page now
  share a single query per request instead of two identical lookups. The "React 19
  needed" notes at those call sites are gone.

## Verification
- `tsc --noEmit` clean (no type breakage from `@types/react` 19).
- **284 tests green.** The anticipated cross-test cache leakage did **not** occur:
  React 19's `cache` is request-scoped, so outside a request (in the tests) it no-ops —
  the detail tests still see their per-test mocks.
- `next build` succeeded.
- **Live:** `/blog/[slug]` and `/stock/[id]` render on the dev server with correct
  `generateMetadata` titles and no runtime errors.

## Follow-up (optional)
- `next-auth` v4 → v5 (Auth.js) to clear the `react ^18` peer warning — not required.
