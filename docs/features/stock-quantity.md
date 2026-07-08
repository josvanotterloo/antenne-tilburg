# Stock quantity tracking

**Status:** branch `feature/stock-quantity` — merged to `master` (2026-07-08).

## Summary
Replaces the boolean-only stock model with quantity tracking. `Product.quantity`
is the source of truth; `inStock` is derived (`quantity > 0`) and kept in sync on
every write, so public queries (which filter `inStock`) are unchanged.

## What's in place
- **Model:** `Product.quantity Int @default(0)`. Migration
  `20260708140000_product_quantity` backfills `inStock=true` rows to quantity 1
  (out-of-stock rows keep the 0 default). `inStock` is retained and indexed.
- **`lib/product-input.ts`:** `parseProductInput` takes `quantity` (non-negative
  integer, default 0) instead of an `inStock` boolean; `toProductData` derives
  `inStock: quantity > 0`. The single place create + update stock is set.
- **`lib/stock.ts`:** `sellOne(quantity)` → decrement floored at 0, with derived
  `inStock`. Pure and unit-tested.
- **`POST /api/admin/products/[id]/sell-one`** (admin): loads the product, applies
  `sellOne`, returns the updated product; 404 for unknown id. Single click.
- **Product form:** a `quantity` number input (min 0) replaces the in-stock toggle;
  `inStock` is derived on save. New products default to quantity 1. The edit form
  has an inline **Sell one** that syncs the input from the route result (so a later
  Save can't overwrite the decrement).
- **Admin catalog list:** shows quantity prominently (red at 0) and a single-click
  **Sell one** per row (disabled at 0, refreshes on success).
- **Seed:** sample products seed a quantity and derive `inStock` (kept consistent).
- **Public site:** unchanged — products with `quantity=0` are `inStock=false` and
  stay hidden, exactly as before.

## Tests & verification
- **TDD unit tests** (334 total green): quantity parsing + `inStock` derivation
  (`product-input`), `sellOne` decrement (`lib/stock`), the sell-one route
  (decrement/derive/404/401), and the admin list (renders quantity + Sell one).
- **`next build` passes.**
- **Live against Postgres:** confirmed the migration backfill left **0** rows with
  `inStock !== quantity > 0`, and a real sell-one round-trip (1 → 0, `inStock`
  false) behaved correctly (then restored).

## Notes / known gaps
- **Authenticated admin UI not screenshotted** this session — the browser login
  session had expired and password entry is out of scope for the assistant. The
  list/edit rendering is covered by the component test and the data layer is
  verified live; a manual glance after login is worth a moment.
- **No stock history / audit** of sell-one events (YAGNI). If needed later, log
  decrements to a separate table.
- **Concurrent sell-one** reads then writes without a transaction; two simultaneous
  clicks could both read N and both write N−1. Fine for a single-admin shop; use a
  transactional decrement if that changes.
