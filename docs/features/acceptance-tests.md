# Gherkin/BDD acceptance tests

A fourth testing layer, on top of the existing Vitest unit/integration
suite: Gherkin `.feature` files under `features/`, one per top user journey,
bound to step definitions under `features/step-definitions/*.test.ts` via
[`@amiceli/vitest-cucumber`](https://vitest-cucumber.miceli.click/).

## Why Vitest, not the standalone `cucumber-js` CLI

Every existing "integration" test in this repo (e.g.
`app/api/newsletter/newsletter-flow.integration.test.ts`) fakes `db`,
`email/send`, and `api-auth` with Vitest's `vi.mock`. The standalone
`@cucumber/cucumber` CLI runs step definitions as plain Node/TS files
outside Vitest, so `vi.mock` isn't available there — exercising the real
route handlers would need a real Postgres DB stood up and cleaned between
scenarios, plus a way to stop `sendEmail` actually calling Resend (it
throws today unless real credentials are set). `@amiceli/vitest-cucumber`
runs Gherkin scenarios as real Vitest tests instead, so step definitions
get `vi.mock` for free and match every existing test in the repo. As a
result, the acceptance suite is automatically swept into `npm test` / CI's
full test run — no separate CI wiring needed.

## The 4 journeys

> **Updated (2026-08-05):** `features/restock-detection.feature` was
> deleted in the New Arrivals overhaul — it tested `getBackInStockProducts()`
> directly, which was removed along with the Back In Stock section (see
> `docs/features/new-arrivals-overhaul.md`). The RESTOCK badge predicate
> (`isRestock`) it also touched on is unaffected and keeps its coverage in
> `lib/catalog.test.ts`.

- `features/newsletter-signup.feature` — double opt-in signup → confirm →
  shows as `CONFIRMED` in the admin subscriber listing.
- `features/stock-search.feature` — searching the catalog by artist name.
- `features/catalog-filter.feature` — filtering stock by genre.
- `features/admin-product.feature` — an admin creates a product and it
  appears in the public catalog.

## What each step definition calls

Step definitions call real production code directly — no browser
automation, no HTTP server:

- **newsletter-signup**: `POST /api/newsletter`, `GET
  /api/newsletter/confirm`, then `db.newsletterSubscriber.findMany()` (the
  same query `app/admin/settings/subscribers/page.tsx` runs before
  rendering — asserting on it directly avoids pulling React Server
  Component rendering into a node-environment acceptance test).
- **stock-search** / **catalog-filter**: `getCatalogPage()` from
  `lib/catalog.ts` directly. As of the New Arrivals overhaul, the public
  `/stock` page has no search or filter UI at all — `getCatalogPage`'s
  search/filter params are exercised only by `/admin/catalog`'s search box
  and this test now, so calling the lib function directly is the faithful
  "existing code" path rather than a stand-in for a public UI that no
  longer exists.
- **admin-product**: `POST /api/admin/products` (with `requireAdmin`
  mocked to resolve `null`, the same pattern every existing admin route
  test in this repo already uses), then the real, unauthenticated `GET
  /api/catalog`.

## Fakes reflect real filtering behavior, not just canned data

Where a scenario's whole point is "only the right rows come back," the
mocked `db.product.findMany` actually filters by the `where` clause it's
called with (matching real Prisma semantics), rather than returning a
fixed array regardless of the query. This came out of `/code-review`: an
earlier version of `stock-search` and `admin-product` asserted only on the
canned mock's return value, so the scenario would have stayed green even
if the real filtering logic (FTS id injection, `inStock` derivation) broke
entirely. Verified by temporarily breaking each in the real `lib/`
code and confirming the acceptance tests failed, then reverting.

## Running

```
npm run test:acceptance   # vitest run features — just this layer
npm test                  # full suite, includes these automatically
```

Not wired into a separate CI step — Vitest's default file glob already
picks up `features/step-definitions/*.test.ts` as part of the normal test
run.
