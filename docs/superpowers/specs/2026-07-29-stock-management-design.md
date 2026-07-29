# Stock management (suppliers, supply orders, stock transactions) — design

**Date:** 2026-07-29 · **Branch:** `feature/stock-management`

## Goal
Replace the current bare `Product.quantity` integer with a proper inventory
system: every quantity change is recorded as a `StockTransaction`, `quantity`
becomes a denormalized cache kept in sync by those transactions, and stock
arrives via `Supplier` → `SupplyOrder` → `SupplyOrderLine` records instead of
just being typed into the product form.

## Non-goals (YAGNI)
- No public-site changes — `inStock`/`quantity` display is unaffected.
- No purchasing/ordering integration with Discogs (explicitly out of scope
  per `docs/antenne-tilburg-website-plan.md`).
- No multi-warehouse/location tracking — one shop, one stock count.
- No email/notification on order receipt.
- No pagination on the transaction-history endpoint — per-product transaction
  counts are small (retail vinyl shop); add it later if that stops being true.
- A `SupplyOrder` can only reference a given `Product` once (`@@unique([supplyOrderId, productId])`
  on `SupplyOrderLine`). Ordering more of the same record later means a new line
  on an editable PENDING order, or a new order — not a second line.

## Data model
Add to `prisma/schema.prisma`, matching the shapes you specified:

```prisma
enum SupplyOrderStatus {
  PENDING
  PARTIAL
  RECEIVED
}

enum StockTransactionType {
  IN
  OUT
  ADJUSTMENT
}

model Supplier {
  id          String       @id @default(cuid())
  name        String       @unique
  contact     String?
  supplyOrders SupplyOrder[]
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt
}

model SupplyOrder {
  id          String            @id @default(cuid())
  supplierId  String
  supplier    Supplier          @relation(fields: [supplierId], references: [id])
  reference   String?
  notes       String?
  orderedAt   DateTime
  receivedAt  DateTime?
  status      SupplyOrderStatus @default(PENDING)
  lines       SupplyOrderLine[]
  createdAt   DateTime          @default(now())
  updatedAt   DateTime          @updatedAt

  @@index([supplierId])
  @@index([status])
}

model SupplyOrderLine {
  id                String       @id @default(cuid())
  supplyOrderId     String
  supplyOrder       SupplyOrder  @relation(fields: [supplyOrderId], references: [id], onDelete: Cascade)
  productId         String
  product           Product      @relation(fields: [productId], references: [id])
  quantityOrdered   Int
  quantityReceived  Int          @default(0)
  transactions      StockTransaction[]
  createdAt         DateTime     @default(now())
  updatedAt         DateTime     @updatedAt

  @@unique([supplyOrderId, productId])
  @@index([productId])
}

model StockTransaction {
  id                String               @id @default(cuid())
  productId         String
  product           Product              @relation(fields: [productId], references: [id])
  type              StockTransactionType
  quantity          Int
  note              String?
  supplyOrderLineId String?
  supplyOrderLine   SupplyOrderLine?     @relation(fields: [supplyOrderLineId], references: [id])
  createdAt         DateTime             @default(now())

  @@index([productId, createdAt])
  @@index([supplyOrderLineId])
}
```

`Product` gains `transactions StockTransaction[]` and `supplyOrderLines SupplyOrderLine[]`
(back-relations). `quantity` stays as-is.

## The core invariant: ledger sum == cache
Every `StockTransaction.quantity` for a product, summed chronologically, must
equal `Product.quantity` at all times — that's what makes the running-balance
history trustworthy. This drives one non-obvious rule:

**Floor-at-zero is applied to the transaction amount, not just the cache.**
If a requested change would take quantity below 0, the *applied* delta is
clamped so the new quantity is 0, and the `StockTransaction` records the
clamped (actual) amount — never the raw requested amount. Concretely: sell-one
requests -1; if current quantity is already 0 it's rejected outright (400,
"nothing left to sell" — no transaction is written, since a 0-quantity ledger
row is meaningless). Adjust-stock requests an arbitrary negative delta; if it
would overshoot (e.g. -5 on a quantity of 2), the applied/recorded delta is
-2 and the response says so, so the admin isn't misled about what happened.

This is implemented as one shared helper (`lib/stock.ts`, `applyStockTransaction`)
used by sell-one, adjust, and order-receipt — a single atomic SQL statement
(same `GREATEST(0, ...)` pattern the current sell-one route already uses)
computes old/new quantity together, and the transaction row is written with
the *actual* applied delta in the same DB transaction as the `Product.quantity`
update. IN transactions (always positive, since receiving can't remove stock)
never hit the clamp in practice, but the same helper path handles them for
consistency.

## Supplier CRUD
Straightforward — `/admin/settings/suppliers`, added to the Settings sub-nav
(`app/admin/settings/layout.tsx`). Fields: name (required, unique), contact
(optional free text). Delete is guarded server-side: 409 if the supplier has
any `SupplyOrder` rows, regardless of status (mirrors the existing
`lib/reference-crud.ts` 409+count pattern used for Label/Genre/ProductType,
though Supplier gets its own route handlers since its shape — `contact`, and
guarding on `supplyOrders` instead of `products` — doesn't fit
`ReferenceDelegate` as-is).

## Supply order lifecycle
Added to the Catalog sub-nav as "Orders" (`/admin/catalog/orders`), alongside
the existing Reference data page.

- **Create**: pick a supplier, optional reference/notes, `orderedAt` (defaults
  to now), and one or more lines (product typeahead — reuses the existing
  `Combobox` pattern from `ProductForm` — + quantity ordered). At least one
  line is required (400 otherwise). Status starts `PENDING`.
- **Edit / delete while `PENDING`**: fully editable (supplier, reference,
  notes, orderedAt, and the line set — same delete-all-and-recreate approach
  `toProductData` uses for artists). Delete removes the order and its lines
  (cascade); both are blocked (409) once status is no longer `PENDING`, since
  by then at least one `StockTransaction` is linked to a line.
- **Receive** (`POST /admin/orders/[id]/receive`): allowed while `PENDING` or
  `PARTIAL`. Body is `{ lines: [{ supplyOrderLineId, receiveNow }] }` —
  `receiveNow` is *this event's* increment, not a new total (avoids
  re-entering already-received counts). For each line with `receiveNow > 0`:
  validate `line.quantityReceived + receiveNow <= line.quantityOrdered`
  (else 400 — can't receive more than was ordered), create one `IN`
  `StockTransaction` (linked via `supplyOrderLineId`), bump
  `Product.quantity`, bump `line.quantityReceived`. All lines in one
  `db.$transaction`. Afterwards: status is `RECEIVED` if every line is fully
  received, else `PARTIAL`. `receivedAt` is set/updated to "now" on every
  receiving event (i.e. it tracks the most recent receipt, not first-vs-last).
  This lets a `PARTIAL` order be received again later for the remainder — no
  separate "re-open" step needed.

## Product admin changes
- `ProductForm`: remove the quantity number input entirely. On the edit page,
  show current quantity as read-only text next to the existing "Sell one"
  button.
- **Sell one**: same button, same route (`POST /products/[id]/sell-one`), but
  internally now goes through `applyStockTransaction` (type `OUT`, quantity
  -1) instead of the raw UPDATE it does today. Still floors at 0 client-side
  (button already disables at `quantity <= 0`) and server-side (400 if
  already 0, per the invariant above).
- **New "Adjust stock" button** (edit page only): opens a small inline form —
  signed integer delta + a required reason note (required specifically for
  `ADJUSTMENT`, since this is the one transaction type with no other source
  of truth for "why did this change"). `POST /products/[id]/adjust`.
- **Transaction history**: a section on the product edit page (below the
  form), reading `GET /products/[id]/transactions` — date, type, quantity
  delta, note, and running balance computed by summing that product's
  transactions oldest-first (the last row must equal current `quantity` —
  useful as a test assertion of the core invariant).

## API surface
```
GET/POST     /api/admin/suppliers
GET/PATCH/DELETE /api/admin/suppliers/[id]

GET/POST     /api/admin/orders
GET/PATCH/DELETE /api/admin/orders/[id]      (PATCH/DELETE only while PENDING)
POST         /api/admin/orders/[id]/receive  (while PENDING or PARTIAL)

POST         /api/admin/products/[id]/sell-one   (existing route, new internals)
POST         /api/admin/products/[id]/adjust     (new)
GET          /api/admin/products/[id]/transactions (new)
```

All admin-guarded via `requireAdmin()` per existing convention.

## Migration & backfill
Two steps, following the `add_artist_entity` / `backfill-artists.ts` precedent:

1. `prisma migrate dev` adds the new enums/tables and the `Product` back-relations.
   No existing `Product` columns change, so there's no "finalize" phase needed
   this time — `quantity` keeps its current meaning throughout.
2. A one-time idempotent script, `scripts/backfill-stock-opening-balance.ts`
   (thin CLI wrapper around a testable `lib/backfill-stock-opening-balance.ts`,
   same split as `backfill-artists.ts`): for every product with `quantity > 0`
   and no existing transactions, create one `ADJUSTMENT` `StockTransaction`
   with `quantity = product.quantity` and a note like `"Opening balance"`.
   Skips products that already have a transaction (safe to re-run).

## Testing plan
Behavioral, per `docs/instructions/testing.md` — TDD, contract-level for
routes, no CSS assertions:

- `lib/stock.ts`: applying IN/OUT/ADJUSTMENT updates `Product.quantity`
  correctly; OUT/ADJUSTMENT floor at 0 and record the *clamped* amount, not
  the requested one; sell-one-at-zero is rejected with no transaction written.
- Sell-one route: creates an `OUT` transaction, decrements quantity, 400 at 0.
- Adjust route: creates an `ADJUSTMENT` transaction with the correct signed
  delta; rejects a missing/blank reason note; rejects delta `0`.
- Supply order receive route: creates one `IN` transaction per received line,
  updates quantities, sets status `RECEIVED` vs `PARTIAL` correctly, rejects
  over-receiving past `quantityOrdered`, supports a second receive call on a
  `PARTIAL` order completing it.
- Supply order edit/delete: rejected (409) once status leaves `PENDING`.
- Supplier delete: 409 with a count when supply orders exist.
- Transaction history route: correct running balance, last row equals
  `Product.quantity`.
- Backfill script: creates exactly one `ADJUSTMENT` per `quantity > 0` product,
  idempotent on re-run, skips `quantity === 0` products.

## Open items I'm deciding rather than asking about
(Flag if any of these don't match your intent — easy to change before the plan is written.)
- No pagination on transaction history (YAGNI note above).
- A product can only appear once per supply order (unique constraint).
- `receivedAt` tracks the most recent receiving event, not first-vs-full.
- Adjust-stock reason note is required; sell-one/receive notes stay optional
  (auto-filled contextually, e.g. nothing needed for sell-one, order
  reference for receipts).
