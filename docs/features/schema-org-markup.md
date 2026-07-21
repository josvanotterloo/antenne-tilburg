# Schema.org structured data (Product, MusicRecording, MusicStore)

**Status:** branch `feature/schema-org-markup` (2026-07-21).

## Summary
JSON-LD structured data on the public product detail page and the home page, so
search engines and AI shopping agents can read product/store facts without
scraping HTML.

## What changed

- **`lib/json-ld.ts`** — `serializeJsonLd(data)`: `JSON.stringify` plus an escape
  of `<` (→ `<`) so DB-sourced content (a product description) embedded in a
  `<script type="application/ld+json">` block can't break out via `</script>`.
- **`lib/structured-data.ts`**:
  - `productJsonLd(product)` — `Product` + `MusicRecording` block: name, brand,
    `sku` (omitted when there's no catalog number), category (genre), and an
    `Offer` with price, `EUR` currency, availability (`InStock`/`OutOfStock`) and
    a `MusicStore` seller.
  - `localBusinessJsonLd(openingHoursSpecification)` — `MusicStore` block: name,
    url, phone, address, and the given hours.
- **`lib/opening-hours.ts`** — added:
  - `getOpeningHours()`: fetches + Monday-orders hours, degrading to `[]` on a
    DB error (same pattern `VisitPage`'s local `getHours()` already used).
  - `toOpeningHoursSpecification(rows)`: maps ordered hour rows to schema.org
    `OpeningHoursSpecification` entries, omitting closed days (schema.org has
    no clean "closed" representation in this list).
- **`lib/catalog.ts`** — added `composeProductDescription(product)`: the
  product's own description, or a composed fallback — shared by the detail
  page's `<meta name="description">` and its Product JSON-LD (previously
  duplicated inline in both places). Also exported `CATALOG_INCLUDE`, reused by
  the detail page's `getProduct` query instead of a second hand-typed copy of
  the same `include`.
- **`app/(public)/stock/[id]/page.tsx`** — renders `productJsonLd(product)`;
  `generateMetadata` now calls `composeProductDescription` instead of
  reimplementing the fallback string.
- **`app/(public)/page.tsx`** — fetches opening hours via the new
  `getOpeningHours()` and renders `localBusinessJsonLd(...)`.

## Design notes / assumptions
- **`OutOfStock` is unreachable on the live page.** The product detail page
  already 404s any product with `inStock: false` ("Out-of-stock products are not
  public" — pre-existing behavior, unchanged here). `productJsonLd` still
  branches correctly on `product.inStock` and is unit-tested for both cases in
  `lib/structured-data.test.ts`, but that branch can only be exercised at the
  page level if that 404 policy changes later. Flagging this explicitly rather
  than changing the 404 behavior myself, since making out-of-stock products
  publicly visible (even just to carry `OutOfStock` structured data) is a
  product decision, not a code fix.
- **`getOpeningHours()` added to `lib/opening-hours.ts`.** First pass duplicated
  `VisitPage`'s local `getHours()` verbatim on the home page to avoid adding a
  DB dependency to a previously pure/framework-free lib file; `/code-review`
  flagged the duplication (two near-identical copies whose log labels were
  already diverging) strongly enough to fix properly. `lib/catalog.ts` already
  mixes pure logic with DB-touching functions, so this isn't a new pattern for
  this codebase's `lib/` modules. Used only by the home page for now —
  `VisitPage`'s own local `getHours()` was intentionally left as-is to keep
  this branch's diff scoped to what the task asked for; unifying it is a
  natural follow-up, not done here.

## Tests
- `lib/json-ld.test.ts` — 2 tests: serializes plain data, escapes `<` while
  preserving the original string on parse.
- `lib/catalog.test.ts` — +2 tests: `composeProductDescription` uses the
  product's own description when present, falls back when there is none.
- `lib/opening-hours.test.ts` — +4 tests: maps open days to schema.org entries,
  omits closed days, `getOpeningHours` orders Monday-first, degrades to `[]` on
  a DB error.
- `lib/structured-data.test.ts` — 5 tests: Product+MusicRecording shape with
  correct price/InStock, OutOfStock availability, `sku` omitted without a
  catalog number, composed description fallback, MusicStore shape with hours.
- `app/(public)/stock/[id]/detail.test.tsx` — +1 test: JSON-LD present with
  correct `@type`, name, price, availability.
- `app/(public)/page.test.tsx` — +2 tests: MusicStore JSON-LD with live hours;
  degrades to an empty `openingHoursSpecification` if the DB call fails.

## Deferred (flagged, not fixed — out of scope for this branch)
- `lib/structured-data.ts`'s `localBusinessJsonLd` hardcodes the shop's
  address/phone as separate literals, duplicating the same real-world facts in
  `VisitPage`'s local (unexported) `SHOP` object — but `SHOP.postal` is one
  combined string while structured data needs `postalCode`/`addressLocality`
  split apart, so a real fix means reshaping `SHOP` or extracting a third
  shared constants module, not a one-line import. Low risk (static facts that
  rarely change) — noted for a future cleanup rather than fixed here.

## Live verification
Checked against the running dev server (real Postgres data):
- `/` — `<script type="application/ld+json">` contains a valid `MusicStore`
  block with real opening hours.
- `/stock/[a real in-stock product id]` — contains a valid `Product` +
  `MusicRecording` block with the real artist/title/price/label/genre and
  `https://schema.org/InStock`.
