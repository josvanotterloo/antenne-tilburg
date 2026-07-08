# Session Log — 2026-07-08 (security hardening)

## What was built
- Fixed the five findings from a full-source security review, TDD'd, one commit
  each: (1) IP rate-limit on newsletter signup, (2) constant-time login,
  (3) atomic sell-one decrement, (4) upload magic-byte sniffing, (5) strict
  `/^\d+$/` quantity validation. 340 tests green; `next build` passes.

## What worked
- Each fix had a test that fails on the old behaviour first: the constant-time
  fix flips a "compare NOT called" assertion to "compare IS called (dummy hash)";
  the upload fix adds a spoofed-`image/png`-with-HTML-bytes case that must 400.
- The atomic sell-one's SQL can't be checked by a mocked `$queryRaw`, so it was
  verified live against Postgres (`1→0`, `0→0` floored, unknown→0 rows).

## What drifted from intent
- Nothing. Fix 3 made the pure `sellOne` helper redundant (logic moved into the
  atomic SQL), so `lib/stock.ts` + its test were removed.

## Signal (what should change in a shared artifact)
- [x] None new.

## Friction points
- Shared module-level rate-limiter state leaked across tests; added a `reset()`
  and called it in `beforeEach` of both the route test and the newsletter
  integration test to keep them isolated.
- A throwaway verify script importing `@prisma/client` directly failed to resolve
  from the scratchpad; using `db.$queryRaw` as a tagged template (via `@/lib/db`)
  avoided the direct Prisma import.

## Updates made
- `lib/rate-limit.ts`(+test), `lib/authorize.ts`(+test), sell-one route(+test),
  `lib/upload-input.ts` + uploads route (+tests), `lib/product-input.ts`(+test);
  removed `lib/stock.ts`(+test); newsletter route + tests; feature doc
  `security-hardening.md`; updated newsletter-sending + stock-quantity docs; log.
