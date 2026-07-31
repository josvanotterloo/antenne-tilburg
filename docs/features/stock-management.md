# Stock management (suppliers, supply orders, stock transactions)

**Status:** branch `feature/stock-management`. Supersedes
`docs/features/stock-quantity.md` — `Product.quantity` is no longer a
hand-edited integer with an ad hoc `sellOne()` helper; it's a cache derived
from an append-only ledger, and stock now arrives via modeled supply orders
instead of typing a number into the product form.

Design spec: `docs/superpowers/specs/2026-07-29-stock-management-design.md`.
Implementation plan (21 tasks, executed via subagent-driven development,
each with an independent task review): `docs/superpowers/plans/2026-07-29-stock-management.md`.

## Summary
Adds `Supplier` → `SupplyOrder` → `SupplyOrderLine` → `StockTransaction` to
the data model. Every change to `Product.quantity` — a sale, a manual
correction, or stock arriving from a supplier — is now recorded as a
`StockTransaction` row, and `quantity` is the cache those rows are
guaranteed to sum to. Touches the data model, the product admin form, a new
Supplier CRUD section, a new Supply Orders section (list/create/edit/detail/
receive), the Catalog sub-nav, and the full test suite.

## The core invariant
A product's `StockTransaction.quantity` values, summed chronologically,
always equal `Product.quantity`. The one function allowed to enforce this —
`lib/stock.ts`'s `applyStockTransaction` — is the sole write path to that
column from here on; sell-one, manual adjustment, and supply-order receiving
all go through it.

```ts
export async function applyStockTransaction(
  tx: Prisma.TransactionClient,
  input: { productId: string; type: "IN" | "OUT" | "ADJUSTMENT";
           requestedQuantity: number; note?: string | null; supplyOrderLineId?: string | null },
): Promise<
  | { ok: true; transaction: StockTransaction; quantity: number; appliedQuantity: number }
  | { ok: false; error: string }
>
```

**Floor-at-zero clamps the recorded amount, not just the cache.** A single
atomic `UPDATE ... SET quantity = GREATEST(0, quantity + requested) ...
RETURNING` (same pattern the old `sell-one` route already used) computes the
old and new quantity together; the delta actually written to the ledger is
`new - old`, never the raw requested amount. Request `-8` on a quantity of
`5` and the ledger records `-5`, not `-8` — verified live against Postgres
(see Tests & verification). This is what keeps "sum of transactions ==
current quantity" true even when a request overshoots zero.

Two deliberate consequences, both approved during design and both
implemented as an explicit rejection rather than a silent no-op:
- Selling at quantity 0 is a 400 ("Stock is already at zero"), not a
  floor-and-succeed — no ledger row is written for a sale that didn't
  happen.
- A positive delta that produces no change (shouldn't occur given current
  callers, but the function doesn't assume it can't) 400s with "No change to
  apply" rather than writing a zero-quantity ledger row.

## Data model
```prisma
enum SupplyOrderStatus { PENDING PARTIAL RECEIVED }
enum StockTransactionType { IN OUT ADJUSTMENT }

model Supplier {
  id           String        @id @default(cuid())
  name         String        @unique
  contact      String?
  supplyOrders SupplyOrder[]
}

model SupplyOrder {
  id         String            @id @default(cuid())
  supplierId String
  supplier   Supplier          @relation(fields: [supplierId], references: [id])
  reference  String?
  notes      String?
  orderedAt  DateTime
  receivedAt DateTime?
  status     SupplyOrderStatus @default(PENDING)
  lines      SupplyOrderLine[]
}

// One product per order — ordering more later means a new line on a
// still-PENDING order, or a new order.
model SupplyOrderLine {
  id               String   @id @default(cuid())
  supplyOrderId    String
  productId        String
  quantityOrdered  Int
  quantityReceived Int      @default(0)

  @@unique([supplyOrderId, productId])
}

model StockTransaction {
  id                String               @id @default(cuid())
  productId         String
  type              StockTransactionType
  quantity          Int
  note              String?
  supplyOrderLineId String?
}
```

`Product.inStock`'s default flips from `true` to `false` — a new product now
starts with zero stock (no way to set an opening quantity at creation time
anymore), so the default that matches "not yet in stock" has to change too.
Missing this was the first bug the task-review loop caught (Task 1):
`prisma migrate dev`'s auto-generated migration also dropped three
unrelated, pre-existing full-text/trigram search indexes
(`product_search_idx`, `product_title_trgm_idx`, `artist_name_trgm_idx`) as
collateral drift, per the long-documented `tasks/lessons.md` pattern
(2026-07-08/2026-07-17/2026-07-29b/c) — caught in review, fixed by trimming
the migration and rebuilding the dev DB from the corrected history.

## Migration + backfill
No phased nullable→backfill→finalize sequence was needed this time —
unlike the artist-entity migration, no existing `Product` column changes
meaning, so a single additive migration plus one backfill script is enough:

1. **`add_stock_management`**: the four new models/enums, plus
   `Product.inStock`'s default change.
2. **Backfill** — `lib/backfill-stock-opening-balance.ts` (pure, injected
   dependencies, same shape as `lib/backfill-artists.ts`) +
   `scripts/backfill-stock-opening-balance.ts`. One `ADJUSTMENT` transaction
   per pre-existing product with `quantity > 0`, note "Opening balance".
   Idempotent (query excludes products that already have any transaction).
   `quantity === 0` products are skipped — a zero-quantity ledger row is
   meaningless.

## Deliberate interface changes
Flagged per this repo's Test Contract and approved before implementation:
- **`POST /api/admin/products/[id]/sell-one`**: now 400s at quantity 0
  (creates no transaction) instead of floor-and-return-200.
- **Product create/update** (`lib/product-input.ts`): no longer accepts
  `quantity` at all — `parseProductInput`/`toProductData` never touch
  `quantity`/`inStock`; Prisma's schema defaults own the column on create,
  and update leaves it untouched.
- **`features/admin-product.feature`** (Gherkin acceptance test): the
  existing "Adding a new product → the product appears in the public
  catalog" scenario asserted a premise the design intentionally breaks (a
  fresh product used to start in stock; now it starts at 0). Approved
  mid-implementation to update the scenario immediately (assert it does
  **not** yet appear) rather than leave it red until close-out, with a
  second scenario added once the adjust route existed to restore full
  create→give-it-stock→now-visible coverage.

## New admin surfaces
- **Suppliers** (`/admin/settings/suppliers`): CRUD, delete guarded (409 +
  count) when the supplier has any `SupplyOrder`, any status — mirrors the
  existing `lib/reference-crud.ts` guard pattern used for Label/Genre/
  ProductType, bespoke rather than reused since `Supplier` carries an extra
  `contact` field and guards on a different relation.
- **Supply orders** (`/admin/catalog/orders`): list, create, detail, edit,
  receive. PATCH/DELETE on an order are guarded to `status === "PENDING"`
  (checked *before* parsing the request body, so a non-PENDING order 409s
  without even validating the payload) — once any receiving has happened,
  the order is immutable via this route. Editing replaces the full line set
  (`deleteMany` + `create`), same pattern as `toProductData`'s artist
  replacement.
- **Receiving** (`POST /api/admin/orders/[id]/receive`): supports
  re-receiving a `PARTIAL` order for the remainder — `receiveNow` in the
  request is that event's increment, not a new total. Validates every
  line's over-receive condition up front, before any write, so a bad line
  anywhere in a multi-line batch 400s before anything is applied. All
  writes (the `IN` transaction per line, the `quantityReceived` increments,
  and the final status/`receivedAt` write) happen inside one
  `db.$transaction`, all through `tx` — a review round caught the task's own
  test double passing an empty object as the transaction client, which
  couldn't have caught a regression to a non-transactional write; fixed with
  a distinct `tx` test double whose separation from `db` was verified by
  deliberately reintroducing the bug and confirming the suite went red.
  `receivedAt` is bumped on every successful receive (not just the first),
  which is what makes re-receiving work — the same field therefore reads as
  "most recently received at," not "first received at."
- **Product edit page**: quantity is read-only text, "Sell one" unchanged,
  new "Adjust stock" (signed delta + required reason) and a stock
  transaction history table below the form (server-rendered directly via
  `lib/stock-history.ts`'s `computeRunningBalance`, not a client fetch —
  consistent with how the rest of this codebase's admin pages read `db`
  directly for their own initial render). History renders newest-first
  (current balance at the top, like a bank statement); an early version of
  the plan's own wording described this backwards ("last entry equals the
  final balance") and that error propagated into a test title and a
  misleading code comment before a task review caught it — the rendering
  itself was always correct, only the description of it was wrong.
- **Catalog sub-nav** (`app/admin/catalog/layout.tsx`, new): Catalog /
  Reference data / Orders. The Catalog root item needed an `exact` flag
  added to `AdminSubNav` — without it, `/admin/catalog` (a *prefix* of every
  other item's href) stayed active on every catalog sub-page simultaneously
  with whichever page you were actually on, producing two
  `aria-current="page"` elements at once. Settings/Content don't hit this
  because none of their items' hrefs are prefixes of a sibling's.
- **`Combobox`** gained an opt-in `allowCreate` prop (default `true`,
  every existing caller unaffected) for the new supply-order line picker,
  which searches products (`/api/admin/products/search`, a new `{id, name}`
  typeahead over `title`/`primaryArtistName`) but can't offer "+ Add" the
  way Label/Genre/Artist pickers do — there's no way to meaningfully create
  a full `Product` from a typed name alone.

## A real bug the automated suite couldn't catch
`AdjustStockForm` rendered its own `<form>` nested inside `ProductForm`'s
outer `<form>` — invalid HTML. Real Chrome silently refuses to fire the
inner submit button's click in that situation (no request, no error, the
component just visually resets); jsdom does not reproduce this, so every
automated test — including a dedicated `AdjustStockForm` test that clicks
the same button — stayed green throughout implementation and review. Found
during the mandatory manual browser walkthrough at close-out, independently
reported by the human tester and reproduced directly (confirmed via a
direct `applyStockTransaction` call against the real dev DB that the
underlying engine was correct, then via live network/DB inspection that the
UI's request never left the browser). Fixed by rendering a `<div>` instead
of a `<form>` and submitting via a plain button `onClick`; a regression test
now asserts `ProductForm` never contains more than one `<form>`, even with
the adjust-stock UI expanded. See `tasks/lessons.md` 2026-07-31b.

## Tests & verification
778 tests green (118 files), `tsc`/lint clean. New coverage per layer:
`lib/stock.ts` (floor/clamp math, the two rejection cases, IN/OUT/ADJUSTMENT),
`lib/backfill-stock-opening-balance.ts`, `lib/stock-history.ts` (running
balance direction), `lib/supplier-input.ts`/`lib/supply-order-input.ts`/
`lib/supply-order-receive-input.ts` (validation, including the duplicate-
line-id guard added after review), every new API route (contract-level:
status codes, guard ordering, transactional atomicity), `SupplierForm`,
`OrderForm`, `AdjustStockForm`, `ReceiveOrderForm`, and the Catalog admin
pages — all role/label/text queries, no CSS assertions. Two Gherkin
scenarios cover the end-to-end "product starts with no stock" /
"adjusting stock makes it visible" flows.

Live-verified against local Postgres and a real logged-in browser session
(after the nested-form fix): create supplier → create product → create
supply order (qty 5) → receive 3 of 5 (status → `PARTIAL`, quantity 3,
history shows `+3`) → receive the remaining 2 (status → `RECEIVED`) → sell
one (quantity -1, `OUT` row) → adjust stock by a delta that overshoots zero
(floors correctly, ledger records the actually-applied amount) → delete the
supplier (blocked, 409, since it now has a supply order).

## Known gaps (accepted, not fixed)
- **Concurrent-receive race**: the pre-receive over-quantity check reads
  `SupplyOrderLine` rows via `findUnique` before entering the transaction;
  only the `Product` row is locked (inside `applyStockTransaction`), not the
  order lines. Two simultaneous receive calls on the same line could both
  pass a stale check. Accepted for an admin-only, single-operator internal
  tool; would need the line read moved inside the transaction with a row
  lock if this ever becomes multi-operator.
- **`receivedAt` on a `PARTIAL` order**: set on every receive event, so the
  orders list can show a "Received" date next to a `PARTIAL` badge, which
  reads as slightly contradictory. Matches the approved re-receiving design;
  not fixed.
- No pagination on the transaction-history route or the orders list — YAGNI
  given expected data volume for a single retail shop.
