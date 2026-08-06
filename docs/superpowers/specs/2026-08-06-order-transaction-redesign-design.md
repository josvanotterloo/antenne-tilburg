# Order & transaction system redesign — design

**Status:** approved, branch `feature/order-transaction-redesign`.
**Supersedes (admin UI only):** the order-management surfaces described in
`docs/features/stock-management.md` — the `Supplier` / `SupplyOrder` /
`SupplyOrderLine` / `StockTransaction` data model and `lib/stock.ts`'s
`applyStockTransaction` invariant are unchanged and still authoritative.

## Context

DJ DMDN places supply orders externally (phone/email) — the admin system is
purely for tracking what was ordered and what arrived. The current admin UI
(a manual order-creation form + a whole-order receive form) doesn't match
that workflow: orders should start with one click from a product row, not a
standalone form, and receiving/quantity edits should happen inline in an
overview rather than on a separate detail page.

## Decisions made during brainstorming

- **Product↔Supplier link**: `Label` had no supplier relation at all before
  this design (`Supplier` only related to `SupplyOrder`). Resolved: add
  `Product.supplierId` (nullable, **authoritative** for ordering) and
  `Label.supplierId` (nullable, **convenience-only** — prefills a new
  product's supplier field from its label, never synced or validated
  against the product's own value after that).
- **"Open order" scope**: an order is open (eligible for quick-add reuse)
  while its status is `PENDING`, `SENT`, or `PARTIAL` — only `RECEIVED` is
  terminal. Adding a product for a supplier whose order was already marked
  `SENT` reopens/adds to that same order rather than starting a new one; the
  admin re-communicates the addition to the supplier out of band. Because
  quick-add always reuses the open order, a supplier has at most one open
  order at any time.
- **Old manual order pages**: removed entirely (`/admin/catalog/orders/new`,
  `/[id]/edit`, `/[id]` detail, `OrderForm`, `ReceiveOrderForm`) — ordering
  is now purely product-driven (quick-add) plus the grouped overview page's
  inline actions. No secondary manual-order path is kept.

## 1. Data model

```prisma
enum SupplyOrderStatus {
  PENDING
  SENT
  PARTIAL
  RECEIVED
}

model Supplier {
  // ...existing fields unchanged...
  products Product[] // new back-relation
  labels   Label[]   // new back-relation
}

model Label {
  // ...existing fields unchanged...
  supplierId String?
  supplier   Supplier? @relation(fields: [supplierId], references: [id])
}

model Product {
  // ...existing fields unchanged...
  supplierId String?
  supplier   Supplier? @relation(fields: [supplierId], references: [id])
}
```

- `Product.supplierId` is nullable — existing products start unlinked, and
  the catalog/transactions "Order" button stays disabled (tooltip "No
  supplier linked") until it's set via the product form.
- `Label.supplierId` only prefills `ProductForm`'s supplier field on
  *create*; it never overwrites an existing product's own choice, and
  nothing enforces the two staying in sync.
- `Supplier`'s existing delete guard (409 if it has any `SupplyOrder`)
  widens to also block deletion when any `Product` or `Label` references it
  — same `lib/reference-crud.ts`-style guard pattern, just more relations
  checked.
- Migration: `npx prisma migrate dev --create-only`, then hand-trim the
  generated SQL against this repo's known `search_vector`/trigram drift
  before applying (per `tasks/lessons.md`, 2026-07-08/07-17/07-29b/c — bare
  `prisma migrate dev` hangs on an interactive prompt here). Purely
  additive (one new enum value, two nullable FKs) — no backfill, no phased
  rollout. Restart the dev server after applying (stale Prisma client,
  lessons.md 07-17b).

## 2. API / lib layer

**`lib/supply-order-quick-add.ts`** (new) — `quickAddToOrder(tx, { productId })`:
1. Load the product's `supplierId`.
2. No `supplierId` → `{ ok:false, status:400, error:"Product has no supplier" }`.
3. Find an open order (`status in [PENDING,SENT,PARTIAL]`) for that supplier.
4. If found and it already has a line for this product →
   `{ ok:false, status:409, error:"Product already in open order" }`.
5. If found without a line for this product → add a line
   (`quantityOrdered:1, quantityReceived:0`).
6. If no open order exists → create one (`status:PENDING, orderedAt:now`)
   with that single line.
7. Return `{ ok:true, status: existed ? 200 : 201, line }`.

`POST /api/admin/orders/quick-add` — thin `requireAdmin` wrapper, body
`{ productId }`.

**`PATCH /api/admin/orders/lines/[id]`** (new — required by the inline
quantity-edit UI in §3 but not itemized in the original route list) — body
`{ quantityOrdered }`. Validates `quantityOrdered` is a positive integer
`>= line.quantityReceived` (400 otherwise); 409 if the parent order's
status is `RECEIVED`.

**`PATCH /api/admin/orders/lines/[id]/receive`** — body
`{ quantityReceived }` (an increment, matching the existing `receiveNow`
semantics, not a new total). Reuses `applyStockTransaction` (type `IN`,
same note/linkage as the current whole-order receive route), increments
the line's `quantityReceived`, then recomputes and persists the parent
order's status (`RECEIVED` if every line is fully received, else
`PARTIAL`) and bumps `receivedAt`. This becomes the sole receiving path;
the old whole-order `POST /api/admin/orders/[id]/receive` is removed.

**`PATCH /api/admin/orders/[id]`** — repurposed (its previous "replace all
lines" behavior loses its only caller once the edit page is removed) to
accept `{ status: "SENT" }` only. Allowed from any non-`RECEIVED` status;
no-op if already `SENT`. `DELETE /api/admin/orders/[id]` is unchanged
(cancel a mistaken order, still guarded to non-`RECEIVED`).

**`GET /api/admin/orders?groupBy=supplier|date|flat`** — backed by
`lib/order-overview.ts`'s `getOpenOrderLines(groupBy)`, called directly
(no HTTP hop) by the overview page's server component, matching this
repo's `lib/catalog.ts` convention of shared query logic. Returns every
line whose parent order is non-`RECEIVED`, with `product` (+ artists,
label, productType) and `supplyOrder` (+ supplier) included. `groupBy`
only reshapes the same rows: nested by supplier, nested by ISO week of
`line.createdAt` (reusing `weekRange` from `lib/catalog.ts`), or a flat
chronological array.

**`GET /api/admin/transactions?month=YYYY-MM`** — `lib/transactions-overview.ts`,
using a new `shopMonthRange` helper (alongside `weekRange`/`shopDayRange`
in `lib/catalog.ts`) for shop-timezone month boundaries. Queries
`StockTransaction` for that range with `product` included, sorted
`createdAt desc`. No running balance — a cross-product balance is
meaningless (see `docs/features/stock-management.md`'s note that
`computeRunningBalance` is inherently per-product); this is a raw
chronological list.

**`getOpenOrderProductIds(productIds: string[])`** (new helper) — one query
joining `SupplyOrderLine` to non-`RECEIVED` `SupplyOrder`s, filtered to the
given product ids, returning a `Set<string>`. Shared by the catalog list
and the transactions page to compute each row's Order-button state without
a per-row query.

**Removed**: `POST /api/admin/orders` (create), `POST
/api/admin/orders/[id]/receive` (whole-order receive), and the old
line-replacement behavior of `PATCH /api/admin/orders/[id]`.

## 3. UI / pages

**Catalog list row** (`app/admin/catalog/page.tsx`) — new `OrderButton`
client component next to `SellOneButton`. The server computes
`hasSupplier`/`alreadyOrdered` once per page (via `getOpenOrderProductIds`)
and passes them down. States: no supplier → disabled, `title="No supplier
linked"`; already in an open order → disabled "Ordered"; else "Order" →
`POST quick-add`, flips to "Ordered" via local state on success (same
optimistic-update pattern as `SellOneButton`, no full reload).

**`/admin/catalog/orders`** (full rewrite, server component reading the new
lib directly):
- Top bar: a grouping toggle (`?group=supplier|date|flat` via plain
  `<Link>`s, default `supplier`) and the auto-print checkbox (client
  component, reads/writes `localStorage`, no server round-trip).
- **Supplier grouping**: one native `<details>`/`<summary>` section per
  supplier (collapse/expand needs no JS). Header: supplier name, "Mark all
  as sent" button (`PATCH .../[id] {status:"SENT"}`, disabled once already
  `SENT` or if the order has no lines), and a disabled "Export PDF" button
  (tooltip "Coming soon" — tracked in `tasks/todo.md`, not built here).
- **Date grouping**: sections headed "Week of {date}" (Mon–Sun via
  `weekRange`), lines flattened across suppliers within each week.
- **Flat**: single chronological table, no sections.
- **Per line row**: artist(s) / title / labelcode (`catalogNumber`) / label
  / format (`productType.name`) / editable qty (client component, `PATCH
  .../lines/[id]`) / date added / status badge (derived per line:
  `quantityReceived===0` → pending, `0<received<ordered` → partial,
  `>=ordered` → received; an open order can show a mix of these across its
  lines) / "Mark received" (click reveals a qty input defaulting to
  `quantityOrdered - quantityReceived`, confirm → `PATCH
  .../lines/[id]/receive`; if the auto-print checkbox is on, immediately
  follow with `GET /api/admin/label/[productId]`).

**`/admin/catalog/transactions`** (new):
- Header: `← Prev | Current selection: {Month Year} | Next →`, plain
  `<Link>`s with `?month=YYYY-MM` (default: current month, shop timezone).
- Table columns: Order (action button) / Qty (transaction delta) / Date /
  Time / Labelcode / Artist / Title / Label / Type — direct render of
  `getMonthTransactions(month)`.
- "Order" button per `OUT` row — the same `OrderButton` component as the
  catalog list, reusing `getOpenOrderProductIds` over that page's product
  ids.

**Sub-nav** (`app/admin/catalog/layout.tsx`): add `{ href:
"/admin/catalog/transactions", label: "Transactions" }` after Orders.

**Removed**: `app/admin/catalog/orders/new/`, `/[id]/edit/`, `/[id]/page.tsx`
(detail), `components/admin/OrderForm.tsx`,
`components/admin/ReceiveOrderForm.tsx`, and their tests.

**Product/Label forms**: `ProductForm` gains an optional Supplier field
(`Combobox`, no `allowCreate`), prefilled from the selected label's
`supplierId` on create only. `LabelForm` (reference-data CRUD) gains an
optional Supplier picker.

## 4. Testing plan

Per this repo's Test Contract: `lib/*.ts` gets full behavioral TDD
coverage, API routes get contract-level tests (status codes, guard
ordering), components get role/text RTL queries. No new Gherkin scenario —
this is additive to the already-covered stock-management end-to-end flow,
not a new user story.

| Spec requirement | Test location |
|---|---|
| quick-add creates order when none exists / adds to existing open order / 409 if already in open order / 400 if no supplier | `lib/supply-order-quick-add.test.ts` + `app/api/admin/orders/quick-add/route.test.ts` |
| transactions endpoint returns correct month | `lib/transactions-overview.test.ts` + route contract test |
| receive endpoint creates IN transaction, updates qty, recomputes order status | `app/api/admin/orders/lines/[id]/receive/route.test.ts` |
| monthly nav renders prev/next with correct params | `app/admin/catalog/transactions/page.test.tsx` |
| Order button disabled when already ordered / no supplier | `components/admin/OrderButton.test.tsx` |
| Auto-print localStorage toggle persists | `components/admin/AutoPrintToggle.test.tsx` |
| PATCH quantityOrdered guards (floor at received, blocked on RECEIVED order) | `app/api/admin/orders/lines/[id]/route.test.ts` |
| Mark-all-as-sent status transition + guard | `app/api/admin/orders/[id]/route.test.ts` (rewritten for the new status-only contract) |
| groupBy=supplier/date/flat shaping | `lib/order-overview.test.ts` |

**Deliberate interface changes** (flagged per the Test Contract — the one
part of this redesign that shrinks the suite rather than only growing it):
tests for `POST /api/admin/orders`, `POST /api/admin/orders/[id]/receive`,
the old line-replacement `PATCH` contract, `OrderForm`, and
`ReceiveOrderForm` are deleted along with the code they cover — not left
red.

## 5. Rollout

Branch: `feature/order-transaction-redesign` (this doc). Close-out per
`docs/instructions/branching.md`: `/code-review` is mandatory (schema
change + new API contracts); manual browser walkthrough (create a supplier
→ link it to a label and a product → quick-add from a catalog row → order
appears grouped by supplier → edit quantity inline → mark received →
confirm the stock transaction and DYMO preview fire → mark-all-as-sent →
confirm the transactions page shows the resulting `IN` row under the
right month); add "Export PDF per supplier group" to `tasks/todo.md`
backlog; `docs/features/NNN-order-transaction-redesign.md`; session log;
`tasks/lessons.md` entry for anything that surprises us during
implementation.
