# Order & transaction system redesign

**Status:** branch `feature/order-transaction-redesign`. Supersedes the
order-management *admin UI* described in `docs/features/stock-management.md`
— the `Supplier` / `SupplyOrder` / `SupplyOrderLine` / `StockTransaction`
data model and `lib/stock.ts`'s `applyStockTransaction` invariant are
unchanged and still authoritative; this redesign only replaces how orders
are created and worked.

Design spec: `docs/superpowers/specs/2026-08-06-order-transaction-redesign-design.md`.
Implementation plan (21 tasks, executed via subagent-driven development,
each with an independent task review): `docs/superpowers/plans/2026-08-06-order-transaction-redesign.md`.

## Summary
DJ DMDN places supply orders externally (phone/email); the admin system only
tracks what was ordered and what arrived. The old admin UI — a manual
order-creation form plus a whole-order receive form — didn't match that
workflow. This redesign replaces it with:

- a one-click **"Order" button** on every catalog/transactions product row
  that quick-adds the product to its supplier's open order (creating one if
  none exists),
- a **grouped orders overview** (`/admin/catalog/orders`) with inline
  quantity editing and per-line receiving, replacing the old list/create/
  edit/detail pages entirely, and
- a new **monthly transactions ledger** (`/admin/catalog/transactions`)
  showing every `StockTransaction` (`IN`/`OUT`/`ADJUSTMENT`) for a given
  month, with an "Order" button on `OUT` rows for quick reordering of
  something that just sold.

`Product.supplierId` (new, authoritative) links a product to the supplier it
gets ordered from; `Label.supplierId` (new, convenience-only) prefills that
field when creating a product under a label whose supplier is already known.

## Data model
```prisma
enum SupplyOrderStatus {
  PENDING
  SENT       // new value, inserted BEFORE PARTIAL
  PARTIAL
  RECEIVED
}

model Label {
  // ...existing fields unchanged...
  supplierId String?
  supplier   Supplier? @relation(fields: [supplierId], references: [id])
  @@index([supplierId])
}

model Product {
  // ...existing fields unchanged...
  supplierId String?
  supplier   Supplier? @relation(fields: [supplierId], references: [id])
  @@index([supplierId])
}
```
Migration `20260806163458_add_order_redesign`: purely additive (one new enum
value, two nullable FKs with `ON DELETE SET NULL`) — no backfill, no phased
rollout needed.

- **`Product.supplierId`** is nullable and is the only field ordering logic
  reads. Until it's set, that product's "Order" button is disabled with
  `title="No supplier linked"`.
- **`Label.supplierId`** only prefills `ProductForm`'s supplier field on
  *create*; it never overwrites an existing product's own value and nothing
  keeps the two in sync.
- **`Supplier`'s delete guard** (`app/api/admin/suppliers/[id]/route.ts`)
  widened from "blocked if it has any `SupplyOrder`" to "blocked if it has
  any `SupplyOrder`, `Product`, or `Label` referencing it" — same
  `_count`-sum-then-409 pattern as before, one more relation checked.
- **"Open order" scope**: `PENDING`, `SENT`, and `PARTIAL` are all open
  (eligible for quick-add reuse); only `RECEIVED` is terminal. Because
  quick-add always reuses a supplier's open order if one exists, a supplier
  has at most one open order at any time — adding a product for a supplier
  whose order was already marked `SENT` reopens/extends that same order.

## New/changed admin surfaces

- **Catalog list "Order" button** (`components/admin/OrderButton.tsx`,
  reused on the transactions page) — three states: disabled/"No supplier
  linked" (no `supplierId`), disabled "Ordered" (already on an open order),
  or "Order" → `POST /api/admin/orders/quick-add {productId}`, optimistic
  flip to "Ordered" on success, no full reload. Button state for a page of
  rows is computed once via `lib/open-order-lookup.ts`'s
  `getOpenOrderProductIds(productIds)` (one query, not one per row).
- **`lib/supply-order-quick-add.ts`**'s `quickAddToOrder(tx, {productId})` —
  400 `"Product has no supplier"` if unlinked; finds the supplier's open
  order and adds a `quantityOrdered: 1` line (200) if found, 409
  `"Product already in open order"` if that line already exists, or creates
  a new `PENDING` order with the line (201) if none exists. Runs inside a
  caller-provided `db.$transaction` — same single-operator-tool tradeoff on
  the find-then-act race already accepted for receiving in
  `docs/features/stock-management.md`.
- **`/admin/catalog/orders`** (full rewrite, server component) — a
  `?group=supplier|date|flat` toggle (default supplier) plus an
  `AutoPrintToggle` (client component, `localStorage`-backed, no server
  round-trip). Supplier grouping uses one native `<details>`/`<summary>`
  per supplier (`SupplierOrderGroup`) with a "Mark all as sent" button
  (`PATCH /api/admin/orders/[id] {status:"SENT"}`, disabled once already
  `SENT`) and a disabled "Export PDF" button (`title="Coming soon"` — see
  Known gaps). Date grouping buckets by ISO week of `line.createdAt`
  (`weekRange`, Mon–Sun) with suppliers flattened within each week. Flat is
  one chronological table. Every row (`OrderLineRow`) shows artist/title/
  labelcode/label/format, an editable quantity input (`PATCH
  /api/admin/orders/lines/[id]`, blurs to save, floors at
  `quantityReceived`), a derived status badge (pending/partial/received),
  and — unless already fully received — a "Mark received" control that
  reveals a quantity input defaulting to the remaining amount, confirming
  via `PATCH /api/admin/orders/lines/[id]/receive`; if the auto-print
  toggle is on, this immediately opens `GET /api/admin/label/[productId]`
  in a new tab.
- **`PATCH /api/admin/orders/lines/[id]`** (new) — body
  `{quantityOrdered}`. 404 if the line doesn't exist, 409 if the parent
  order is `RECEIVED`, 400 if the new quantity is below
  `quantityReceived` (`"Cannot set quantity below the N already
  received"`).
- **`PATCH /api/admin/orders/lines/[id]/receive`** (new, sole receiving
  path) — body `{quantityReceived}` (an increment, not a new total). 400 if
  not a positive integer, 400 if it would exceed `quantityOrdered`.
  Wraps `applyStockTransaction` (type `IN`, note "Received from supply
  order", linked via `supplyOrderLineId`), increments the line's
  `quantityReceived`, then recomputes the parent order's status —
  `RECEIVED` once every line is fully received, else `PARTIAL` — and bumps
  `receivedAt` on every call (so it reads as "most recently received at",
  not "first received at", same as the prior whole-order route).
- **`PATCH /api/admin/orders/[id]`** — repurposed to accept only
  `{status: "SENT"}` (400 `'Only { status: "SENT" } is supported' `
  otherwise); 409 if the order is already `RECEIVED`. `DELETE` is
  unchanged (still guarded to `status === "PENDING"`).
- **`GET`-equivalent `lib/order-overview.ts`'s `getOpenOrderLines(groupBy)`**
  — called directly by the orders page server component (no HTTP hop,
  matching `lib/catalog.ts`'s convention). Returns every line whose parent
  order is non-`RECEIVED`, shaped by `groupBy` into `SupplierGroup[]`,
  `WeekGroup[]`, or a flat array.
- **`/admin/catalog/transactions`** (new) — `lib/transactions-overview.ts`'s
  `getMonthTransactions(month)`, using new `shopMonthRange` helper (shop-
  timezone month boundaries, alongside `weekRange`/`shopDayRange` in
  `lib/catalog.ts`) against a `?month=YYYY-MM` param (default: current
  month). `← Prev` / `Current selection: {Month Year}` / `Next →` plain
  `<Link>` nav. Table columns: Order / Date / Time / Labelcode / Artist /
  Title / Label / Qty (signed, `+N` for positive) / Type. No running
  balance — unlike `lib/stock-history.ts`'s per-product view, a
  cross-product balance is meaningless; this is a raw chronological ledger,
  newest first. `OUT` rows get the same `OrderButton` as the catalog list,
  reusing `getOpenOrderProductIds` scoped to that page's `OUT` product ids.
- **Sub-nav** (`app/admin/catalog/layout.tsx`): "Transactions" added after
  "Orders".
- **Product/Label forms**: `ProductForm` gained an optional Supplier
  `Combobox` (no `allowCreate`), prefilled from the selected label's
  `supplierId` on create only; `LabelForm` gained an optional Supplier
  picker.

## Removed surfaces
Per the design's "no secondary manual-order path" decision:
- Pages: `app/admin/catalog/orders/new/`, `/[id]/edit/`, `/[id]/page.tsx`
  (detail).
- Components: `OrderForm.tsx`, `ReceiveOrderForm.tsx`, and their tests.
- Routes: `POST /api/admin/orders` (create), `POST
  /api/admin/orders/[id]/receive` (whole-order receive), and the old
  line-replacement behavior of `PATCH /api/admin/orders/[id]`.

`app/api/admin/orders/[id]/route.ts` now only supports mark-all-as-sent and
cancelling a still-`PENDING` order — its old GET/detail and full
line-replacement behavior are gone along with the pages that were their
only callers.

## Tests & verification
842 tests green (132 files), `tsc`/lint clean — up from 789 at the prior
close-out (reference page typeahead, 2026-08-06). New coverage per this
plan's 20 implementation tasks: `lib/supply-order-quick-add.ts` (all four
outcomes: create/add-to-existing/409-duplicate/400-no-supplier),
`lib/order-overview.ts` (supplier/date/flat shaping), `lib/transactions-
overview.ts`, every new/changed route (`quick-add`, `orders/lines/[id]`,
`orders/lines/[id]/receive`, the repurposed `orders/[id]` PATCH) at
contract level (status codes, guard ordering), and `OrderButton`,
`AutoPrintToggle`, `OrderLineRow`, `OrderLinesTable`, `SupplierOrderGroup`,
plus the orders and transactions page components — role/label/text queries
only, no CSS assertions. Per the Test Contract, tests for the removed
routes/components (`POST /api/admin/orders`, the old whole-order receive
route, `OrderForm`, `ReceiveOrderForm`) were deleted along with the code
they covered, not left red — the one part of this plan that shrank the
suite rather than only growing it.

Manual browser walkthrough (create a supplier → link it to a label and a
product → click "Order" on the product's catalog row → order appears
grouped under the supplier on `/admin/catalog/orders` → edit quantity
inline → mark received → confirm stock quantity increases and the DYMO
label preview fires → "Mark all as sent" → confirm the resulting `IN` row
appears under the right month on `/admin/catalog/transactions` → confirm an
`OUT` row's "Order" button quick-adds correctly → toggle auto-print,
reload, confirm it persists) is tracked separately as part of this task's
close-out, not repeated here.

## Known gaps (accepted, not fixed)
- **Export PDF per supplier group**: the button is present on each supplier
  group header on `/admin/catalog/orders` but permanently disabled
  (`title="Coming soon"`) — not built in this plan. Tracked in
  `tasks/todo.md`.
- **Concurrent-receive race** and **no pagination on the orders/transactions
  lists**: both inherited unchanged from `docs/features/stock-management.md`
  — this redesign didn't touch `applyStockTransaction` or add volume beyond
  what that doc already accepted for a single-operator internal tool.
- **`MONTH_PARAM` regex** (`app/admin/catalog/transactions/page.tsx`)
  accepts syntactically-valid-but-semantically-invalid months like
  `2026-13`/`2026-00`, unlike `shopMonthRange`'s stricter internal check —
  not a functional bug since `shiftMonth`'s wraparound math doesn't crash on
  it, just a slightly looser client-facing guard than the server-side one.
- **`Label.supplierId` / `Product.supplierId` can drift**: by design, the
  label's value only ever prefills a new product's field once; nothing
  flags or prevents the two disagreeing afterward.
