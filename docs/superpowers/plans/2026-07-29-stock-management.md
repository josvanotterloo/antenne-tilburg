# Stock Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `Product.quantity` as a hand-edited integer with a ledger-backed inventory system: `StockTransaction` records every change, `Supplier`/`SupplyOrder`/`SupplyOrderLine` model how stock arrives, and `quantity` becomes a cache kept in sync by the ledger.

**Architecture:** One shared, floor-at-zero-and-record-the-clamped-amount engine (`lib/stock.ts`) is the only code path allowed to change `Product.quantity` going forward. Sell-one, manual adjustments, and supply-order receiving all call it. Admin CRUD for Supplier and SupplyOrder follows this codebase's existing reference-list / notices patterns exactly (server-component list pages reading `db` directly, client-component forms posting to `/api/admin/*` routes, `requireAdmin()` on every mutation).

**Tech Stack:** Next.js 16 App Router, TypeScript, Prisma 6 + PostgreSQL, Vitest + Testing Library.

## Global Constraints

- Prisma access only via the `lib/db.ts` singleton — never `new PrismaClient()`.
- Every admin mutation route calls `requireAdmin()` first and returns immediately on a non-null result.
- No CSS/Tailwind-class assertions in any test — behavior only (`docs/instructions/testing.md`).
- Run tests via the `run-tests` skill, never a hand-built command.
- `npm run typecheck` and `npm run lint` clean after every task before committing.
- Commit after every task (pre-commit hook runs lint + typecheck + full suite; do not `--no-verify`).
- This plan makes two **approved, deliberate** breaking changes to existing passing tests (both signed off in `docs/superpowers/specs/2026-07-29-stock-management-design.md`):
  1. `POST /api/admin/products/[id]/sell-one` now 400s at quantity 0 instead of returning 200 with `quantity: 0` (Task 5).
  2. `Product` create/update no longer accepts `quantity` — it's derived exclusively from transactions (Task 3).

---

## Task 1: Schema — Supplier, SupplyOrder, SupplyOrderLine, StockTransaction

**Files:**
- Modify: `prisma/schema.prisma`
- Create: a new migration under `prisma/migrations/` (via Prisma CLI, not hand-written)

**Interfaces:**
- Produces: `Supplier`, `SupplyOrder`, `SupplyOrderLine`, `StockTransaction` Prisma models; `SupplyOrderStatus` (`PENDING`/`PARTIAL`/`RECEIVED`) and `StockTransactionType` (`IN`/`OUT`/`ADJUSTMENT`) enums; `Product.transactions` and `Product.supplyOrderLines` back-relations. Every later task's Prisma Client types come from this.

There's no failing-test cycle for a schema change — the "test" is that `prisma migrate dev` applies cleanly and `prisma generate` produces types the rest of the plan can import.

- [ ] **Step 1: Edit `prisma/schema.prisma`**

Add the two enums near the existing `Condition`/`PostStatus` enums:

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
```

Add the four new models (placed after `Product`, before `Post`):

```prisma
model Supplier {
  id           String        @id @default(cuid())
  name         String        @unique
  contact      String?
  supplyOrders SupplyOrder[]
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt
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
  createdAt  DateTime          @default(now())
  updatedAt  DateTime          @updatedAt

  @@index([supplierId])
  @@index([status])
}

// One product per order (@@unique below) — ordering more of the same record
// later means a new line on a still-PENDING order, or a new order.
model SupplyOrderLine {
  id               String             @id @default(cuid())
  supplyOrderId    String
  supplyOrder      SupplyOrder        @relation(fields: [supplyOrderId], references: [id], onDelete: Cascade)
  productId        String
  product          Product            @relation(fields: [productId], references: [id])
  quantityOrdered  Int
  quantityReceived Int                @default(0)
  transactions     StockTransaction[]
  createdAt        DateTime           @default(now())
  updatedAt        DateTime           @updatedAt

  @@unique([supplyOrderId, productId])
  @@index([productId])
}

// The ledger. Every row's `quantity` is the actual applied delta (see
// lib/stock.ts) — summed chronologically per product, it always equals
// that product's Product.quantity. `note` carries the adjustment reason
// (required by the /adjust route) or context for IN/OUT.
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

In the existing `Product` model, add the two back-relations next to `productArtists`:

```prisma
  transactions      StockTransaction[]
  supplyOrderLines  SupplyOrderLine[]
```

And change the `inStock` field's default and comment — it must start `false` to match `quantity`'s `0` default now that product create no longer sets both explicitly (Task 3 removes that):

```prisma
  // Derived from quantity (> 0) and kept in sync by lib/stock.ts on every
  // transaction. Defaults false to match quantity's 0 default — a brand-new
  // product has no stock until a transaction (adjust/receive) gives it some.
  inStock           Boolean         @default(false)
```

- [ ] **Step 2: Run the migration**

```bash
npx prisma migrate dev --name add_stock_management
```

Expected: migration applies cleanly, no errors. Existing `Product` rows are unaffected — `inStock`'s new default only applies to rows created after this migration.

- [ ] **Step 3: Regenerate the client and typecheck**

```bash
npx prisma generate
npm run typecheck
```

Expected: typecheck passes (nothing consumes the new models yet, so there's nothing to break).

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat: add Supplier, SupplyOrder, SupplyOrderLine, StockTransaction schema"
```

---

## Task 2: Core stock engine — `lib/stock.ts`

**Files:**
- Create: `lib/stock.ts`
- Test: `lib/stock.test.ts`

**Interfaces:**
- Consumes: `Prisma.TransactionClient` (from `@prisma/client`) — duck-typed as `{ $queryRaw, stockTransaction: { create } }` in tests.
- Produces: `applyStockTransaction(tx, input): Promise<ApplyStockTransactionResult>` — used by Tasks 5, 6, 17.
  ```ts
  export interface ApplyStockTransactionInput {
    productId: string;
    type: "IN" | "OUT" | "ADJUSTMENT";
    requestedQuantity: number; // nonzero; IN positive, OUT negative, ADJUSTMENT either sign
    note?: string | null;
    supplyOrderLineId?: string | null;
  }
  export type ApplyStockTransactionResult =
    | { ok: true; transaction: StockTransaction; quantity: number; appliedQuantity: number }
    | { ok: false; error: string };
  ```

- [ ] **Step 1: Write the failing tests**

```ts
// lib/stock.test.ts
import { describe, it, expect, vi } from "vitest";

import { applyStockTransaction } from "@/lib/stock";

function fakeTx(rows: { newQuantity: number; previousQuantity: number }[]) {
  return {
    $queryRaw: vi.fn().mockResolvedValue(rows),
    stockTransaction: { create: vi.fn((args: { data: unknown }) => Promise.resolve({ id: "t1", ...args.data })) },
  };
}

describe("applyStockTransaction", () => {
  it("records the full requested delta when it doesn't hit the floor", async () => {
    const tx = fakeTx([{ newQuantity: 3, previousQuantity: 5 }]);
    const result = await applyStockTransaction(tx as never, {
      productId: "p1",
      type: "OUT",
      requestedQuantity: -2,
    });
    expect(result).toMatchObject({ ok: true, quantity: 3, appliedQuantity: -2 });
    expect(tx.stockTransaction.create).toHaveBeenCalledWith({
      data: {
        productId: "p1",
        type: "OUT",
        quantity: -2,
        note: null,
        supplyOrderLineId: null,
      },
    });
  });

  it("clamps at zero and records the actually-applied (smaller) delta", async () => {
    // Requested -5 on a quantity of 2 — DB floors to 0, applied is -2.
    const tx = fakeTx([{ newQuantity: 0, previousQuantity: 2 }]);
    const result = await applyStockTransaction(tx as never, {
      productId: "p1",
      type: "ADJUSTMENT",
      requestedQuantity: -5,
      note: "recount",
    });
    expect(result).toMatchObject({ ok: true, quantity: 0, appliedQuantity: -2 });
    expect(tx.stockTransaction.create).toHaveBeenCalledWith({
      data: { productId: "p1", type: "ADJUSTMENT", quantity: -2, note: "recount", supplyOrderLineId: null },
    });
  });

  it("rejects a negative request when already at zero, with no transaction written", async () => {
    const tx = fakeTx([{ newQuantity: 0, previousQuantity: 0 }]);
    const result = await applyStockTransaction(tx as never, {
      productId: "p1",
      type: "OUT",
      requestedQuantity: -1,
    });
    expect(result).toEqual({ ok: false, error: "Stock is already at zero" });
    expect(tx.stockTransaction.create).not.toHaveBeenCalled();
  });

  it("returns 'Product not found' when the update matches no row", async () => {
    const tx = fakeTx([]);
    const result = await applyStockTransaction(tx as never, {
      productId: "missing",
      type: "IN",
      requestedQuantity: 5,
    });
    expect(result).toEqual({ ok: false, error: "Product not found" });
    expect(tx.stockTransaction.create).not.toHaveBeenCalled();
  });

  it("links an IN transaction to its supply order line", async () => {
    const tx = fakeTx([{ newQuantity: 10, previousQuantity: 5 }]);
    await applyStockTransaction(tx as never, {
      productId: "p1",
      type: "IN",
      requestedQuantity: 5,
      supplyOrderLineId: "line1",
    });
    expect(tx.stockTransaction.create).toHaveBeenCalledWith({
      data: { productId: "p1", type: "IN", quantity: 5, note: null, supplyOrderLineId: "line1" },
    });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Use the `run-tests` skill on `lib/stock.test.ts`. Expected: FAIL — `lib/stock.ts` doesn't exist yet.

- [ ] **Step 3: Implement `lib/stock.ts`**

```ts
// lib/stock.ts
import { Prisma, type StockTransaction, type StockTransactionType } from "@prisma/client";

// The one code path allowed to change Product.quantity. Floors at zero, and
// — critically — records the ACTUALLY-APPLIED delta (never the raw request)
// so that summing a product's transactions chronologically always equals its
// current Product.quantity. `requestedQuantity` must be nonzero; that's the
// caller's responsibility (sell-one always passes -1, adjust rejects a 0
// delta, receive only calls this for lines with receiveNow > 0).

export interface ApplyStockTransactionInput {
  productId: string;
  type: StockTransactionType;
  requestedQuantity: number;
  note?: string | null;
  supplyOrderLineId?: string | null;
}

export type ApplyStockTransactionResult =
  | { ok: true; transaction: StockTransaction; quantity: number; appliedQuantity: number }
  | { ok: false; error: string };

export async function applyStockTransaction(
  tx: Prisma.TransactionClient,
  input: ApplyStockTransactionInput,
): Promise<ApplyStockTransactionResult> {
  const rows = await tx.$queryRaw<{ newQuantity: number; previousQuantity: number }[]>(
    Prisma.sql`
      WITH prev AS (
        SELECT quantity FROM "Product" WHERE id = ${input.productId} FOR UPDATE
      )
      UPDATE "Product"
      SET quantity = GREATEST(0, (SELECT quantity FROM prev) + ${input.requestedQuantity}),
          "inStock" = GREATEST(0, (SELECT quantity FROM prev) + ${input.requestedQuantity}) > 0
      WHERE id = ${input.productId}
      RETURNING quantity AS "newQuantity", (SELECT quantity FROM prev) AS "previousQuantity"
    `,
  );

  const row = rows[0];
  if (!row) return { ok: false, error: "Product not found" };

  const appliedQuantity = row.newQuantity - row.previousQuantity;
  if (appliedQuantity === 0) {
    return {
      ok: false,
      error: input.requestedQuantity < 0 ? "Stock is already at zero" : "No change to apply",
    };
  }

  const transaction = await tx.stockTransaction.create({
    data: {
      productId: input.productId,
      type: input.type,
      quantity: appliedQuantity,
      note: input.note ?? null,
      supplyOrderLineId: input.supplyOrderLineId ?? null,
    },
  });

  return { ok: true, transaction, quantity: row.newQuantity, appliedQuantity };
}
```

- [ ] **Step 4: Run to verify it passes**

Use the `run-tests` skill on `lib/stock.test.ts`. Expected: PASS, all 5 cases.

- [ ] **Step 5: Commit**

```bash
git add lib/stock.ts lib/stock.test.ts
git commit -m "feat: add applyStockTransaction, the shared floor-at-zero ledger engine"
```

---

## Task 3: Remove `quantity` from product create/update (approved interface change)

**Files:**
- Modify: `lib/product-input.ts`
- Modify: `lib/product-input.test.ts`
- Modify: `app/api/admin/products/products.test.ts`

**Interfaces:**
- Produces: `ProductInput` (no longer has `quantity`); `toProductData(...)` return value no longer includes `quantity`/`inStock` at all.
- Consumed by: `app/api/admin/products/route.ts` (POST), `app/api/admin/products/[id]/route.ts` (PATCH) — unchanged, since both just pass through whatever `toProductData` returns.

This is the approved breaking interface change flagged in Global Constraints. `quantity`/`inStock` are no longer set by product create/update at all — Prisma's schema defaults (`0` / `false`, from Task 1) apply on create, and update simply never touches those two columns.

- [ ] **Step 1: Update the failing/changing tests first**

In `lib/product-input.test.ts`:
- Remove `quantity: 1` from the `VALID` fixture.
- Remove `quantity: 1` from the "accepts and normalizes valid input" `toMatchObject` block.
- Delete the `"defaults quantity to 0 and nullifies blank optionals"` test's quantity assertion (keep the catalogNumber/description assertions; rename if the title no longer fits — it becomes `"nullifies blank optionals"`).
- Delete the `"accepts quantity as a number or a numeric string"` test entirely.
- Delete the `it.each` quantity-rejection block (`"rejects %s quantity"`) entirely.
- In the `toProductData` describe block: rename `"toProductData — derives inStock from quantity"` to `"toProductData — no longer touches quantity/inStock"`, replace its first three tests (`"in stock when quantity > 0"`, `"out of stock when quantity is 0"`) with one:
  ```ts
  it("never includes quantity or inStock in the returned data", () => {
    const data = toProductData(base, { primaryArtistName: "Vril", mode: "create" });
    expect(data).not.toHaveProperty("quantity");
    expect(data).not.toHaveProperty("inStock");
  });
  ```
  Remove `quantity: 1` / `quantity: 0` from the remaining tests in that block (`base` no longer needs it since `ProductInput` won't have the field).

In `app/api/admin/products/products.test.ts`:
- Remove `quantity: 2` from `validBody`.
- Remove `quantity: 2,` and `inStock: true, // derived from quantity > 0` from the `product.create` assertion in `"creates a product from valid input"`.
- Leave `ROW` as-is (`quantity`/`inStock` there represent what a fetched product looks like, which is legitimate — they just don't come from the request anymore).

- [ ] **Step 2: Run to verify the edited tests reflect intent**

Use the `run-tests` skill on both files. Expected: they still reference `lib/product-input.ts`'s current (pre-edit) behavior, so `toProductData`'s "no longer includes quantity" test FAILS (the field is still there) — that's the RED you want before Step 3.

- [ ] **Step 3: Edit `lib/product-input.ts`**

Remove `quantity: number;` from the `ProductInput` interface. Remove the entire quantity-parsing block (the `rawQty`/`quantity` `let` block and its `if (!Number.isInteger...)` guard) from `parseProductInput`, and remove `quantity,` from its returned `data`. In `toProductData`, remove the `quantity: data.quantity,` and `inStock: data.quantity > 0,` lines from the returned object entirely (don't replace them with anything — the columns are simply absent from the write).

- [ ] **Step 4: Run to verify it passes**

Use the `run-tests` skill on `lib/product-input.test.ts` and `app/api/admin/products/products.test.ts`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/product-input.ts lib/product-input.test.ts app/api/admin/products/products.test.ts
git commit -m "refactor: product create/update no longer sets quantity — derived from transactions only"
```

---

## Task 4: Opening-balance backfill script

**Files:**
- Create: `lib/backfill-stock-opening-balance.ts`
- Test: `lib/backfill-stock-opening-balance.test.ts`
- Create: `scripts/backfill-stock-opening-balance.ts`

**Interfaces:**
- Produces: `backfillStockOpeningBalance(deps): Promise<{ productsBackfilled: number }>` — pure, DI'd like `lib/backfill-artists.ts`, so it's testable without a real DB.

- [ ] **Step 1: Write the failing test**

```ts
// lib/backfill-stock-opening-balance.test.ts
import { describe, it, expect, vi } from "vitest";

import { backfillStockOpeningBalance } from "@/lib/backfill-stock-opening-balance";

describe("backfillStockOpeningBalance", () => {
  it("creates one ADJUSTMENT transaction per product with quantity > 0 and no existing transactions", async () => {
    const create = vi.fn().mockResolvedValue({ id: "t1" });
    const result = await backfillStockOpeningBalance({
      findProductsNeedingBackfill: () =>
        Promise.resolve([
          { id: "p1", quantity: 5 },
          { id: "p2", quantity: 2 },
        ]),
      createOpeningTransaction: create,
    });
    expect(result).toEqual({ productsBackfilled: 2 });
    expect(create).toHaveBeenCalledWith({ productId: "p1", quantity: 5 });
    expect(create).toHaveBeenCalledWith({ productId: "p2", quantity: 2 });
  });

  it("does nothing when there are no products to backfill", async () => {
    const create = vi.fn();
    const result = await backfillStockOpeningBalance({
      findProductsNeedingBackfill: () => Promise.resolve([]),
      createOpeningTransaction: create,
    });
    expect(result).toEqual({ productsBackfilled: 0 });
    expect(create).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Use the `run-tests` skill. Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement `lib/backfill-stock-opening-balance.ts`**

```ts
// lib/backfill-stock-opening-balance.ts
// One-time migration: give every pre-existing product with stock an opening
// ADJUSTMENT transaction, so the ledger invariant (sum of transactions ==
// Product.quantity) holds from day one. quantity === 0 products are skipped —
// a 0-quantity ledger entry is meaningless (see lib/stock.ts's own "no
// transaction at zero" rule). Idempotent: the caller's finder query excludes
// products that already have any transaction.

export interface ProductNeedingBackfill {
  id: string;
  quantity: number;
}

export interface BackfillStockDeps {
  findProductsNeedingBackfill: () => Promise<ProductNeedingBackfill[]>;
  createOpeningTransaction: (args: { productId: string; quantity: number }) => Promise<unknown>;
}

export async function backfillStockOpeningBalance(
  deps: BackfillStockDeps,
): Promise<{ productsBackfilled: number }> {
  const products = await deps.findProductsNeedingBackfill();
  for (const product of products) {
    await deps.createOpeningTransaction({ productId: product.id, quantity: product.quantity });
  }
  return { productsBackfilled: products.length };
}
```

- [ ] **Step 4: Run to verify it passes**

Use the `run-tests` skill. Expected: PASS.

- [ ] **Step 5: Write the CLI wrapper**

```ts
// scripts/backfill-stock-opening-balance.ts
//
//   Run AFTER the add_stock_management migration (Task 1) — see
//   docs/features/stock-management.md.
//
//   Run:  npx tsx scripts/backfill-stock-opening-balance.ts
//
// Idempotent: products that already have a StockTransaction are skipped by
// the query itself, so re-running after a partial failure is safe.
import { PrismaClient } from "@prisma/client";

import { backfillStockOpeningBalance } from "../lib/backfill-stock-opening-balance";

const prisma = new PrismaClient();

async function main() {
  const result = await backfillStockOpeningBalance({
    findProductsNeedingBackfill: () =>
      prisma.product.findMany({
        where: { quantity: { gt: 0 }, transactions: { none: {} } },
        select: { id: true, quantity: true },
      }),
    createOpeningTransaction: ({ productId, quantity }) =>
      prisma.stockTransaction.create({
        data: { productId, type: "ADJUSTMENT", quantity, note: "Opening balance" },
      }),
  });
  console.log(`Done: ${result.productsBackfilled} product(s) backfilled.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

- [ ] **Step 6: Run it against the dev database**

```bash
npx tsx scripts/backfill-stock-opening-balance.ts
```

Expected: reports the number of products backfilled (matches however many dev-seeded products have `quantity > 0`).

- [ ] **Step 7: Commit**

```bash
git add lib/backfill-stock-opening-balance.ts lib/backfill-stock-opening-balance.test.ts scripts/backfill-stock-opening-balance.ts
git commit -m "feat: one-time backfill of opening-balance stock transactions"
```

---

## Task 5: Sell-one route uses the ledger (approved interface change)

**Files:**
- Modify: `app/api/admin/products/[id]/sell-one/route.ts`
- Modify: `app/api/admin/products/[id]/sell-one/route.test.ts`

**Interfaces:**
- Consumes: `applyStockTransaction` from Task 2.
- Response shape unchanged: `{ id, quantity, inStock }` on success. New: 400 (not 200) when already at zero.

- [ ] **Step 1: Rewrite the test file for the new contract**

```ts
// app/api/admin/products/[id]/sell-one/route.test.ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

vi.mock("@/lib/api-auth", () => ({
  requireAdmin: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/lib/db", () => ({ db: { $transaction: vi.fn((fn: (tx: unknown) => unknown) => fn({})) } }));
vi.mock("@/lib/stock", () => ({ applyStockTransaction: vi.fn() }));

import { POST } from "@/app/api/admin/products/[id]/sell-one/route";
import { applyStockTransaction } from "@/lib/stock";
import { requireAdmin } from "@/lib/api-auth";

const mockApply = applyStockTransaction as unknown as Mock;
const mockRequireAdmin = vi.mocked(requireAdmin);
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const req = () => new Request("http://test", { method: "POST" });

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAdmin.mockResolvedValue(null);
});

describe("POST /api/admin/products/[id]/sell-one", () => {
  it("creates an OUT transaction of -1 and returns the updated product", async () => {
    mockApply.mockResolvedValue({ ok: true, quantity: 1, appliedQuantity: -1 });
    const res = await POST(req(), ctx("p1"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: "p1", quantity: 1, inStock: true });
    expect(mockApply).toHaveBeenCalledWith(expect.anything(), {
      productId: "p1",
      type: "OUT",
      requestedQuantity: -1,
    });
  });

  it("404s an unknown product", async () => {
    mockApply.mockResolvedValue({ ok: false, error: "Product not found" });
    const res = await POST(req(), ctx("nope"));
    expect(res.status).toBe(404);
  });

  it("400s when already at zero, with the message from the engine", async () => {
    mockApply.mockResolvedValue({ ok: false, error: "Stock is already at zero" });
    const res = await POST(req(), ctx("p1"));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Stock is already at zero" });
  });

  it("returns the 401 from requireAdmin without applying anything", async () => {
    mockRequireAdmin.mockResolvedValue(new Response(null, { status: 401 }) as never);
    const res = await POST(req(), ctx("p1"));
    expect(res.status).toBe(401);
    expect(mockApply).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Use the `run-tests` skill. Expected: FAIL — the route still does the old raw-SQL-only implementation, doesn't call `applyStockTransaction`, and never 400s at zero.

- [ ] **Step 3: Rewrite the route**

```ts
// app/api/admin/products/[id]/sell-one/route.ts
import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { applyStockTransaction } from "@/lib/stock";

type RouteContext = { params: Promise<{ id: string }> };

// Sell one unit — always an OUT transaction of -1. Floors at zero and 400s
// if there's nothing left to sell (button is disabled client-side at 0; this
// is the server-side backstop for a race between two rapid clicks).
export async function POST(_req: Request, ctx: RouteContext) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await ctx.params;
  const result = await db.$transaction((tx) =>
    applyStockTransaction(tx, { productId: id, type: "OUT", requestedQuantity: -1 }),
  );

  if (!result.ok) {
    const status = result.error === "Product not found" ? 404 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }
  return NextResponse.json({ id, quantity: result.quantity, inStock: result.quantity > 0 });
}
```

- [ ] **Step 4: Run to verify it passes**

Use the `run-tests` skill. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/products/[id]/sell-one/route.ts app/api/admin/products/[id]/sell-one/route.test.ts
git commit -m "refactor: sell-one goes through the stock ledger, 400s at zero instead of floor-and-200"
```

---

## Task 6: Adjust stock route

**Files:**
- Create: `lib/product-adjust-input.ts`
- Test: `lib/product-adjust-input.test.ts`
- Create: `app/api/admin/products/[id]/adjust/route.ts`
- Test: `app/api/admin/products/[id]/adjust/route.test.ts`

**Interfaces:**
- Produces: `parseAdjustInput(body): ParseResult` where `ParseResult = { ok: true; data: { delta: number; note: string } } | { ok: false; error: string }`.
- Route response on success: `{ quantity: number; appliedQuantity: number; clamped: boolean }`.

- [ ] **Step 1: Write the failing lib test**

```ts
// lib/product-adjust-input.test.ts
import { describe, it, expect } from "vitest";

import { parseAdjustInput } from "@/lib/product-adjust-input";

describe("parseAdjustInput", () => {
  it("accepts a positive delta with a reason", () => {
    const result = parseAdjustInput({ delta: 5, note: "found a missing box" });
    expect(result).toEqual({ ok: true, data: { delta: 5, note: "found a missing box" } });
  });

  it("accepts a negative delta", () => {
    const result = parseAdjustInput({ delta: -3, note: "damaged" });
    expect(result.ok && result.data.delta).toBe(-3);
  });

  it("trims the note", () => {
    const result = parseAdjustInput({ delta: 1, note: "  recount  " });
    expect(result.ok && result.data.note).toBe("recount");
  });

  it("rejects a zero delta", () => {
    expect(parseAdjustInput({ delta: 0, note: "x" }).ok).toBe(false);
  });

  it("rejects a non-integer delta", () => {
    expect(parseAdjustInput({ delta: 1.5, note: "x" }).ok).toBe(false);
  });

  it("rejects a missing or blank note", () => {
    expect(parseAdjustInput({ delta: 1 }).ok).toBe(false);
    expect(parseAdjustInput({ delta: 1, note: "   " }).ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Use the `run-tests` skill. Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement `lib/product-adjust-input.ts`**

```ts
// lib/product-adjust-input.ts
export interface AdjustInput {
  delta: number;
  note: string;
}

export type ParseResult = { ok: true; data: AdjustInput } | { ok: false; error: string };

// Unlike sell-one/receive (whose amount and context are implicit in the
// action), a manual adjustment has no other record of "why" — the note is
// required so the ledger stays self-explanatory.
export function parseAdjustInput(body: unknown): ParseResult {
  const b = (body ?? {}) as Record<string, unknown>;

  const delta = typeof b.delta === "number" ? b.delta : NaN;
  if (!Number.isInteger(delta) || delta === 0) {
    return { ok: false, error: "Delta must be a non-zero whole number" };
  }

  const note = typeof b.note === "string" ? b.note.trim() : "";
  if (!note) {
    return { ok: false, error: "A reason is required" };
  }

  return { ok: true, data: { delta, note } };
}
```

- [ ] **Step 4: Run to verify it passes**

Use the `run-tests` skill. Expected: PASS.

- [ ] **Step 5: Write the failing route test**

```ts
// app/api/admin/products/[id]/adjust/route.test.ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

vi.mock("@/lib/api-auth", () => ({ requireAdmin: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/db", () => ({ db: { $transaction: vi.fn((fn: (tx: unknown) => unknown) => fn({})) } }));
vi.mock("@/lib/stock", () => ({ applyStockTransaction: vi.fn() }));

import { POST } from "@/app/api/admin/products/[id]/adjust/route";
import { applyStockTransaction } from "@/lib/stock";
import { requireAdmin } from "@/lib/api-auth";

const mockApply = applyStockTransaction as unknown as Mock;
const mockRequireAdmin = vi.mocked(requireAdmin);
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const req = (body: unknown) =>
  new Request("http://test", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAdmin.mockResolvedValue(null);
});

describe("POST /api/admin/products/[id]/adjust", () => {
  it("applies a positive adjustment", async () => {
    mockApply.mockResolvedValue({ ok: true, quantity: 8, appliedQuantity: 3 });
    const res = await POST(req({ delta: 3, note: "recount" }), ctx("p1"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ quantity: 8, appliedQuantity: 3, clamped: false });
    expect(mockApply).toHaveBeenCalledWith(expect.anything(), {
      productId: "p1",
      type: "ADJUSTMENT",
      requestedQuantity: 3,
      note: "recount",
    });
  });

  it("reports clamped:true when the applied amount was floored", async () => {
    mockApply.mockResolvedValue({ ok: true, quantity: 0, appliedQuantity: -2 });
    const res = await POST(req({ delta: -5, note: "damaged" }), ctx("p1"));
    expect(await res.json()).toMatchObject({ appliedQuantity: -2, clamped: true });
  });

  it("400s invalid input without calling the engine", async () => {
    const res = await POST(req({ delta: 0, note: "x" }), ctx("p1"));
    expect(res.status).toBe(400);
    expect(mockApply).not.toHaveBeenCalled();
  });

  it("404s an unknown product", async () => {
    mockApply.mockResolvedValue({ ok: false, error: "Product not found" });
    const res = await POST(req({ delta: 1, note: "x" }), ctx("nope"));
    expect(res.status).toBe(404);
  });

  it("returns the 401 from requireAdmin without parsing or applying", async () => {
    mockRequireAdmin.mockResolvedValue(new Response(null, { status: 401 }) as never);
    const res = await POST(req({ delta: 1, note: "x" }), ctx("p1"));
    expect(res.status).toBe(401);
    expect(mockApply).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 6: Run to verify it fails**

Use the `run-tests` skill. Expected: FAIL — route doesn't exist.

- [ ] **Step 7: Implement the route**

```ts
// app/api/admin/products/[id]/adjust/route.ts
import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { applyStockTransaction } from "@/lib/stock";
import { parseAdjustInput } from "@/lib/product-adjust-input";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: RouteContext) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await ctx.params;
  const parsed = parseAdjustInput(await req.json().catch(() => null));
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const result = await db.$transaction((tx) =>
    applyStockTransaction(tx, {
      productId: id,
      type: "ADJUSTMENT",
      requestedQuantity: parsed.data.delta,
      note: parsed.data.note,
    }),
  );

  if (!result.ok) {
    const status = result.error === "Product not found" ? 404 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }
  return NextResponse.json({
    quantity: result.quantity,
    appliedQuantity: result.appliedQuantity,
    clamped: result.appliedQuantity !== parsed.data.delta,
  });
}
```

- [ ] **Step 8: Run to verify it passes**

Use the `run-tests` skill. Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add lib/product-adjust-input.ts lib/product-adjust-input.test.ts app/api/admin/products/[id]/adjust
git commit -m "feat: add manual stock adjustment route"
```

---

## Task 7: Transaction history — running balance + route

**Files:**
- Create: `lib/stock-history.ts`
- Test: `lib/stock-history.test.ts`
- Create: `app/api/admin/products/[id]/transactions/route.ts`
- Test: `app/api/admin/products/[id]/transactions/route.test.ts`

**Interfaces:**
- Produces: `computeRunningBalance(rows: StockHistoryRow[]): StockHistoryEntry[]` — pure; `rows` must be oldest-first, returns newest-first with `runningBalance`. Reused directly by Task 9's edit-page section (no HTTP round-trip needed there).

- [ ] **Step 1: Write the failing lib test**

```ts
// lib/stock-history.test.ts
import { describe, it, expect } from "vitest";

import { computeRunningBalance } from "@/lib/stock-history";

const row = (over: Partial<Parameters<typeof computeRunningBalance>[0][number]>) => ({
  id: "t1",
  type: "IN" as const,
  quantity: 1,
  note: null,
  createdAt: new Date("2026-01-01"),
  ...over,
});

describe("computeRunningBalance", () => {
  it("accumulates oldest-first, returns newest-first, last entry equals the final balance", () => {
    const result = computeRunningBalance([
      row({ id: "t1", quantity: 5, createdAt: new Date("2026-01-01") }),
      row({ id: "t2", quantity: -2, createdAt: new Date("2026-01-02") }),
      row({ id: "t3", quantity: 3, createdAt: new Date("2026-01-03") }),
    ]);
    expect(result.map((r) => r.id)).toEqual(["t3", "t2", "t1"]);
    expect(result.map((r) => r.runningBalance)).toEqual([6, 3, 5]);
  });

  it("returns an empty array for a product with no transactions", () => {
    expect(computeRunningBalance([])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Use the `run-tests` skill. Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement `lib/stock-history.ts`**

```ts
// lib/stock-history.ts
export interface StockHistoryRow {
  id: string;
  type: "IN" | "OUT" | "ADJUSTMENT";
  quantity: number;
  note: string | null;
  createdAt: Date;
}

export interface StockHistoryEntry extends StockHistoryRow {
  runningBalance: number;
}

// `rows` must already be ordered oldest-first. The last entry's
// runningBalance equals Product.quantity by construction (see lib/stock.ts) —
// useful as a direct assertion of that invariant in integration tests.
export function computeRunningBalance(rows: StockHistoryRow[]): StockHistoryEntry[] {
  let balance = 0;
  const withBalance = rows.map((row) => {
    balance += row.quantity;
    return { ...row, runningBalance: balance };
  });
  return withBalance.slice().reverse();
}
```

- [ ] **Step 4: Run to verify it passes**

Use the `run-tests` skill. Expected: PASS.

- [ ] **Step 5: Write the failing route test**

```ts
// app/api/admin/products/[id]/transactions/route.test.ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api-auth", () => ({ requireAdmin: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/db", () => ({ db: { stockTransaction: { findMany: vi.fn() } } }));

import { GET } from "@/app/api/admin/products/[id]/transactions/route";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/api-auth";

const mockRequireAdmin = vi.mocked(requireAdmin);
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const req = () => new Request("http://test");

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAdmin.mockResolvedValue(null);
});

describe("GET /api/admin/products/[id]/transactions", () => {
  it("returns the running-balance history, newest first", async () => {
    vi.mocked(db.stockTransaction.findMany).mockResolvedValue([
      { id: "t1", type: "IN", quantity: 5, note: null, createdAt: new Date("2026-01-01") },
      { id: "t2", type: "OUT", quantity: -1, note: null, createdAt: new Date("2026-01-02") },
    ] as never);
    const res = await GET(req(), ctx("p1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.map((r: { id: string }) => r.id)).toEqual(["t2", "t1"]);
    expect(body[0].runningBalance).toBe(4);
    expect(db.stockTransaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { productId: "p1" }, orderBy: { createdAt: "asc" } }),
    );
  });

  it("returns the 401 from requireAdmin without querying", async () => {
    mockRequireAdmin.mockResolvedValue(new Response(null, { status: 401 }) as never);
    const res = await GET(req(), ctx("p1"));
    expect(res.status).toBe(401);
    expect(db.stockTransaction.findMany).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 6: Run to verify it fails**

Use the `run-tests` skill. Expected: FAIL — route doesn't exist.

- [ ] **Step 7: Implement the route**

```ts
// app/api/admin/products/[id]/transactions/route.ts
import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { computeRunningBalance } from "@/lib/stock-history";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: RouteContext) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await ctx.params;
  const rows = await db.stockTransaction.findMany({
    where: { productId: id },
    orderBy: { createdAt: "asc" },
    select: { id: true, type: true, quantity: true, note: true, createdAt: true },
  });
  return NextResponse.json(computeRunningBalance(rows));
}
```

- [ ] **Step 8: Run to verify it passes**

Use the `run-tests` skill. Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add lib/stock-history.ts lib/stock-history.test.ts app/api/admin/products/[id]/transactions
git commit -m "feat: add running-balance stock transaction history"
```

---

## Task 8: ProductForm — remove quantity input, add read-only display + Adjust stock

**Files:**
- Create: `components/admin/AdjustStockForm.tsx`
- Test: `components/admin/AdjustStockForm.test.tsx`
- Modify: `components/admin/ProductForm.tsx`
- Modify: `components/admin/ProductForm.test.tsx`

**Interfaces:**
- Produces: `AdjustStockForm({ productId, onAdjusted }: { productId: string; onAdjusted: (quantity: number) => void })`.
- Consumes: `POST /api/admin/products/[id]/adjust` from Task 6.

- [ ] **Step 1: Write the failing test for `AdjustStockForm`**

```tsx
// components/admin/AdjustStockForm.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { AdjustStockForm } from "@/components/admin/AdjustStockForm";

beforeEach(() => vi.restoreAllMocks());

describe("AdjustStockForm", () => {
  it("is collapsed by default, showing only the trigger button", () => {
    render(<AdjustStockForm productId="p1" onAdjusted={vi.fn()} />);
    expect(screen.getByRole("button", { name: /adjust stock/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/reason/i)).toBeNull();
  });

  it("submits a delta + reason and calls onAdjusted with the new quantity", async () => {
    const user = userEvent.setup();
    const onAdjusted = vi.fn();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ quantity: 7, appliedQuantity: 2, clamped: false }),
      }),
    );

    render(<AdjustStockForm productId="p1" onAdjusted={onAdjusted} />);
    await user.click(screen.getByRole("button", { name: /adjust stock/i }));
    await user.type(screen.getByLabelText(/quantity delta/i), "2");
    await user.type(screen.getByLabelText(/reason/i), "recount");
    fireEvent.click(screen.getByRole("button", { name: /save adjustment/i }));

    await waitFor(() => expect(onAdjusted).toHaveBeenCalledWith(7));
  });

  it("shows a visible error when the adjustment fails", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: "A reason is required" }) }),
    );

    render(<AdjustStockForm productId="p1" onAdjusted={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /adjust stock/i }));
    await user.type(screen.getByLabelText(/quantity delta/i), "1");
    await user.type(screen.getByLabelText(/reason/i), "x");
    fireEvent.click(screen.getByRole("button", { name: /save adjustment/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/reason is required/i);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Use the `run-tests` skill. Expected: FAIL — component doesn't exist.

- [ ] **Step 3: Implement `AdjustStockForm`**

```tsx
// components/admin/AdjustStockForm.tsx
"use client";

import { useState } from "react";

import { apiSend } from "@/lib/api-client";
import { useAsyncAction } from "@/lib/use-async-action";

interface AdjustStockFormProps {
  productId: string;
  onAdjusted: (quantity: number) => void;
}

// Inline expand/collapse form for a manual stock correction (ADJUSTMENT
// transaction). The reason note is required server-side — it's the only
// record of "why" an adjustment happened.
export function AdjustStockForm({ productId, onAdjusted }: AdjustStockFormProps) {
  const [open, setOpen] = useState(false);
  const [delta, setDelta] = useState("");
  const [note, setNote] = useState("");
  const { pending, error, run } = useAsyncAction();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    run(async () => {
      const result = await apiSend<{ quantity: number }>(
        `/api/admin/products/${productId}/adjust`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ delta: Number(delta), note }),
        },
      );
      onAdjusted(result.quantity);
      setOpen(false);
      setDelta("");
      setNote("");
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded border border-admin-hairline px-2 py-1 text-xs hover:bg-admin-raised"
      >
        Adjust stock
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2 rounded border border-admin-hairline p-2">
      <div className="flex gap-2">
        <input
          type="number"
          step="1"
          required
          aria-label="Quantity delta"
          placeholder="e.g. -2 or 5"
          value={delta}
          onChange={(e) => setDelta(e.target.value)}
          className="w-24 rounded border border-admin-hairline px-2 py-1 text-sm"
        />
        <input
          type="text"
          required
          aria-label="Reason"
          placeholder="Reason"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="flex-1 rounded border border-admin-hairline px-2 py-1 text-sm"
        />
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded border border-admin-hairline px-2 py-1 text-xs hover:bg-admin-raised disabled:opacity-40"
        >
          {pending ? "…" : "Save adjustment"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-admin-ink-muted hover:underline"
        >
          Cancel
        </button>
      </div>
      {error && (
        <p role="alert" className="text-xs text-red-400">
          {error}
        </p>
      )}
    </form>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Use the `run-tests` skill. Expected: PASS.

- [ ] **Step 5: Update `ProductForm.test.tsx` for the new quantity display**

In `"renders every field of the product"`, replace:
```ts
    expect(
      screen.getByRole("spinbutton", { name: /quantity/i }),
    ).toBeInTheDocument();
```
with nothing (delete those lines) — a brand-new product has no quantity concept to show at all now.

Add a new test after `"shows the sell-one button only when editing an existing product"`:
```tsx
  it("shows quantity as read-only text with Adjust stock, only when editing", () => {
    const { unmount } = render(<ProductForm product={PRODUCT} />);
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.queryByRole("spinbutton", { name: /quantity/i })).toBeNull();
    expect(screen.getByRole("button", { name: /adjust stock/i })).toBeInTheDocument();
    unmount();

    render(<ProductForm />);
    expect(screen.queryByRole("button", { name: /adjust stock/i })).toBeNull();
  });
```

- [ ] **Step 6: Run to verify the ProductForm tests fail**

Use the `run-tests` skill on `components/admin/ProductForm.test.tsx`. Expected: FAIL — the quantity `<input>` still exists (spinbutton assertion for "every field" now unexpectedly finds nothing to remove, but the new read-only test fails since there's no read-only text yet and no Adjust stock button).

- [ ] **Step 7: Edit `ProductForm.tsx`**

Remove the `quantity` state's tie to a form input — keep `quantity` as local display state (still needed so `handleSellOne`/`AdjustStockForm`'s `onAdjusted` can update it without a full reload), but source it only from `product?.quantity`:
```ts
  const [quantity, setQuantity] = useState(product?.quantity ?? 0);
```
(was: `useState(product?.quantity != null ? String(product.quantity) : "1")` — now a `number`, not a display-formatted string default of `"1"` for new products, since new products no longer get a manufactured starting quantity).

Update `handleSellOne` (it currently does `setQuantity(String(updated.quantity))`) to `setQuantity(updated.quantity)`.

Remove `quantity` from the `handleSubmit` JSON body — delete the `quantity,` line.

Add the import:
```ts
import { AdjustStockForm } from "@/components/admin/AdjustStockForm";
```

Replace the entire `<Field label="Quantity in stock" ...>` block with:
```tsx
      {product && (
        <Field label="Quantity in stock">
          <p className="text-lg font-semibold tabular-nums">{quantity}</p>
          <p className="text-xs text-admin-ink-muted">
            Derived from stock transactions — 0 hides the product from the shop.
          </p>
          <div className="mt-1 flex items-center gap-2">
            <button
              type="button"
              onClick={handleSellOne}
              disabled={selling || quantity <= 0}
              className="rounded border border-admin-hairline px-2 py-1 text-xs hover:bg-admin-raised disabled:opacity-40"
            >
              {selling ? "…" : "Sell one"}
            </button>
            <AdjustStockForm productId={product.id} onAdjusted={setQuantity} />
          </div>
        </Field>
      )}
```

`ProductFormValues.quantity` in the interface stays as `number` (already is) — it's still the initial-display source, just no longer form-submitted.

- [ ] **Step 8: Run to verify it passes**

Use the `run-tests` skill on `components/admin/ProductForm.test.tsx` and `components/admin/AdjustStockForm.test.tsx`. Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add components/admin/AdjustStockForm.tsx components/admin/AdjustStockForm.test.tsx components/admin/ProductForm.tsx components/admin/ProductForm.test.tsx
git commit -m "feat: read-only quantity + Adjust stock on the product edit form"
```

---

## Task 9: Transaction history section on the product edit page

**Files:**
- Modify: `app/admin/catalog/[id]/edit/page.tsx`
- Create: `app/admin/catalog/[id]/edit/edit-page.test.tsx`

**Interfaces:**
- Consumes: `computeRunningBalance` from Task 7 (called directly server-side — same pattern as the rest of this codebase's admin pages reading `db` directly rather than hitting their own API route).

- [ ] **Step 1: Write the failing test**

```tsx
// app/admin/catalog/[id]/edit/edit-page.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  notFound: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  db: {
    product: { findUnique: vi.fn() },
    stockTransaction: { findMany: vi.fn() },
  },
}));

import EditProductPage from "@/app/admin/catalog/[id]/edit/page";
import { db } from "@/lib/db";

const PRODUCT = {
  id: "p1",
  productArtists: [{ artist: { id: "a1", name: "Vril" } }],
  title: "Torus",
  catalogNumber: "ZR-001",
  label: { id: "l1", name: "Zulema Records" },
  genre: { id: "g1", name: "Techno" },
  productType: { id: "t1", name: "LP" },
  condition: "NEW",
  price: "24.99",
  description: null,
  coverImage: null,
  quantity: 4,
};

beforeEach(() => vi.clearAllMocks());

describe("/admin/catalog/[id]/edit", () => {
  it("shows the transaction history with a running balance", async () => {
    vi.mocked(db.product.findUnique).mockResolvedValue(PRODUCT as never);
    vi.mocked(db.stockTransaction.findMany).mockResolvedValue([
      { id: "t1", type: "ADJUSTMENT", quantity: 5, note: "Opening balance", createdAt: new Date("2026-01-01") },
      { id: "t2", type: "OUT", quantity: -1, note: null, createdAt: new Date("2026-01-02") },
    ] as never);

    const ui = await EditProductPage({ params: Promise.resolve({ id: "p1" }) });
    render(ui);

    expect(screen.getByText("Opening balance")).toBeInTheDocument();
    expect(screen.getByText("OUT")).toBeInTheDocument();
    // Last transaction's running balance (4) matches Product.quantity.
    expect(screen.getAllByText("4").length).toBeGreaterThan(0);
  });

  it("shows a placeholder when there's no history yet", async () => {
    vi.mocked(db.product.findUnique).mockResolvedValue(PRODUCT as never);
    vi.mocked(db.stockTransaction.findMany).mockResolvedValue([] as never);

    const ui = await EditProductPage({ params: Promise.resolve({ id: "p1" }) });
    render(ui);

    expect(screen.getByText(/no stock transactions yet/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Use the `run-tests` skill. Expected: FAIL — the page doesn't query `stockTransaction` or render any history yet.

- [ ] **Step 3: Edit `app/admin/catalog/[id]/edit/page.tsx`**

Add imports:
```ts
import { computeRunningBalance } from "@/lib/stock-history";
```

After the existing `product` fetch, add:
```ts
  const transactions = await db.stockTransaction.findMany({
    where: { productId: id },
    orderBy: { createdAt: "asc" },
    select: { id: true, type: true, quantity: true, note: true, createdAt: true },
  });
  const history = computeRunningBalance(transactions);
```

Append a history section below `<ProductForm ... />`, inside the returned `<div className="space-y-6">`:
```tsx
      <div className="max-w-3xl space-y-2">
        <h2 className="text-lg font-semibold">Stock transactions</h2>
        {history.length === 0 ? (
          <p className="rounded border border-dashed border-admin-hairline p-4 text-sm text-admin-ink-muted">
            No stock transactions yet.
          </p>
        ) : (
          <div className="overflow-x-auto rounded border border-admin-hairline bg-admin-surface">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-admin-hairline bg-admin-bg text-admin-ink-muted">
                <tr>
                  <th className="px-3 py-2 font-medium">Date</th>
                  <th className="px-3 py-2 font-medium">Type</th>
                  <th className="px-3 py-2 font-medium">Quantity</th>
                  <th className="px-3 py-2 font-medium">Note</th>
                  <th className="px-3 py-2 font-medium">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-admin-hairline">
                {history.map((entry) => (
                  <tr key={entry.id}>
                    <td className="px-3 py-2 text-admin-ink-muted">
                      {entry.createdAt.toLocaleString()}
                    </td>
                    <td className="px-3 py-2">{entry.type}</td>
                    <td className="px-3 py-2 tabular-nums">
                      {entry.quantity > 0 ? `+${entry.quantity}` : entry.quantity}
                    </td>
                    <td className="px-3 py-2 text-admin-ink-muted">{entry.note ?? "—"}</td>
                    <td className="px-3 py-2 tabular-nums">{entry.runningBalance}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
```

- [ ] **Step 4: Run to verify it passes**

Use the `run-tests` skill. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/admin/catalog/[id]/edit/page.tsx app/admin/catalog/[id]/edit/edit-page.test.tsx
git commit -m "feat: show stock transaction history with running balance on the product edit page"
```

---

## Task 10: Supplier input parsing + API routes

**Files:**
- Create: `lib/supplier-input.ts`
- Test: `lib/supplier-input.test.ts`
- Create: `app/api/admin/suppliers/route.ts`
- Create: `app/api/admin/suppliers/[id]/route.ts`
- Test: `app/api/admin/suppliers/suppliers.test.ts`

**Interfaces:**
- Produces: `parseSupplierInput(body): { ok: true; data: { name: string; contact: string | null } } | { ok: false; error: string }`.
- Route contract: `GET ?q=` typeahead (id/name, capped at 20, matches `lib/reference-crud.ts`'s contract so the existing `Combobox` component works unmodified) + `POST` create; `PATCH`/`DELETE` on `[id]`, delete guarded (409) when `supplyOrders` count > 0.

- [ ] **Step 1: Write the failing lib test**

```ts
// lib/supplier-input.test.ts
import { describe, it, expect } from "vitest";

import { parseSupplierInput } from "@/lib/supplier-input";

describe("parseSupplierInput", () => {
  it("accepts a name with optional contact, trimmed", () => {
    const result = parseSupplierInput({ name: "  Kalahari Oyster Cult  ", contact: " ask for Jules " });
    expect(result).toEqual({ ok: true, data: { name: "Kalahari Oyster Cult", contact: "ask for Jules" } });
  });

  it("nullifies a blank or absent contact", () => {
    expect(parseSupplierInput({ name: "X", contact: "" }).ok && (parseSupplierInput({ name: "X", contact: "" }) as { data: { contact: null } }).data.contact).toBeNull();
    const absent = parseSupplierInput({ name: "X" });
    expect(absent.ok && absent.data.contact).toBeNull();
  });

  it("rejects a blank name", () => {
    expect(parseSupplierInput({ name: "   " }).ok).toBe(false);
    expect(parseSupplierInput({}).ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Use the `run-tests` skill. Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement `lib/supplier-input.ts`**

```ts
// lib/supplier-input.ts
export interface SupplierInput {
  name: string;
  contact: string | null;
}

export type ParseResult = { ok: true; data: SupplierInput } | { ok: false; error: string };

export function parseSupplierInput(body: unknown): ParseResult {
  const b = (body ?? {}) as Record<string, unknown>;
  const name = typeof b.name === "string" ? b.name.trim() : "";
  if (!name) return { ok: false, error: "Name is required" };
  const contact = typeof b.contact === "string" ? b.contact.trim() : "";
  return { ok: true, data: { name, contact: contact || null } };
}
```

- [ ] **Step 4: Run to verify it passes**

Use the `run-tests` skill. Expected: PASS.

- [ ] **Step 5: Write the failing route test**

```ts
// app/api/admin/suppliers/suppliers.test.ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

vi.mock("@/lib/api-auth", () => ({ requireAdmin: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/db", () => ({
  db: {
    supplier: { findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), findUnique: vi.fn() },
  },
}));

import { db } from "@/lib/db";
import { GET, POST } from "@/app/api/admin/suppliers/route";
import { PATCH, DELETE } from "@/app/api/admin/suppliers/[id]/route";
import { requireAdmin } from "@/lib/api-auth";

const supplier = db.supplier as unknown as {
  findMany: Mock; create: Mock; update: Mock; delete: Mock; findUnique: Mock;
};
const mockRequireAdmin = vi.mocked(requireAdmin);
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const req = (method: string, url: string, body?: unknown) =>
  new Request(url, {
    method,
    headers: { "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAdmin.mockResolvedValue(null);
});

describe("GET /api/admin/suppliers", () => {
  it("searches by name (?q=), capped and alphabetical", async () => {
    supplier.findMany.mockResolvedValue([{ id: "s1", name: "Kalahari Oyster Cult" }]);
    const res = await GET(req("GET", "http://t/api/admin/suppliers?q=kala"));
    expect(res.status).toBe(200);
    expect(supplier.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { name: { contains: "kala", mode: "insensitive" } },
        orderBy: { name: "asc" },
        take: 20,
      }),
    );
  });
});

describe("POST /api/admin/suppliers", () => {
  it("creates a supplier (201)", async () => {
    supplier.create.mockResolvedValue({ id: "s1", name: "X", contact: null });
    const res = await POST(req("POST", "http://t/api/admin/suppliers", { name: "X" }));
    expect(res.status).toBe(201);
  });

  it("400s a blank name", async () => {
    const res = await POST(req("POST", "http://t/api/admin/suppliers", { name: "" }));
    expect(res.status).toBe(400);
    expect(supplier.create).not.toHaveBeenCalled();
  });

  it("409s a duplicate name", async () => {
    supplier.create.mockRejectedValue({ code: "P2002" });
    const res = await POST(req("POST", "http://t/api/admin/suppliers", { name: "X" }));
    expect(res.status).toBe(409);
  });
});

describe("PATCH /api/admin/suppliers/[id]", () => {
  it("updates name/contact", async () => {
    supplier.update.mockResolvedValue({ id: "s1", name: "Y", contact: "ask Jules" });
    const res = await PATCH(req("PATCH", "http://t/x", { name: "Y", contact: "ask Jules" }), ctx("s1"));
    expect(res.status).toBe(200);
  });
});

describe("DELETE /api/admin/suppliers/[id]", () => {
  it("404s when the supplier doesn't exist", async () => {
    supplier.findUnique.mockResolvedValue(null);
    const res = await DELETE(req("DELETE", "http://t/x"), ctx("missing"));
    expect(res.status).toBe(404);
  });

  it("409s (with count) when supply orders exist", async () => {
    supplier.findUnique.mockResolvedValue({ id: "s1", _count: { supplyOrders: 2 } });
    const res = await DELETE(req("DELETE", "http://t/x"), ctx("s1"));
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ count: 2 });
    expect(supplier.delete).not.toHaveBeenCalled();
  });

  it("deletes when no supply orders exist", async () => {
    supplier.findUnique.mockResolvedValue({ id: "s1", _count: { supplyOrders: 0 } });
    const res = await DELETE(req("DELETE", "http://t/x"), ctx("s1"));
    expect(res.status).toBe(200);
    expect(supplier.delete).toHaveBeenCalledWith({ where: { id: "s1" } });
  });
});
```

- [ ] **Step 6: Run to verify it fails**

Use the `run-tests` skill. Expected: FAIL — routes don't exist.

- [ ] **Step 7: Implement `app/api/admin/suppliers/route.ts`**

```ts
// app/api/admin/suppliers/route.ts
import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { parseSupplierInput } from "@/lib/supplier-input";

const SEARCH_LIMIT = 20;

function isUniqueViolation(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === "P2002";
}

// ?q= typeahead — same contract as lib/reference-crud.ts's GET, so the
// existing Combobox component works against this route unmodified.
export async function GET(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  const suppliers = await db.supplier.findMany({
    where: q ? { name: { contains: q, mode: "insensitive" } } : undefined,
    orderBy: { name: "asc" },
    take: SEARCH_LIMIT,
  });
  return NextResponse.json(suppliers);
}

export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const parsed = parseSupplierInput(await req.json().catch(() => null));
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  try {
    const created = await db.supplier.create({ data: parsed.data });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return NextResponse.json({ error: `"${parsed.data.name}" already exists` }, { status: 409 });
    }
    throw error;
  }
}
```

- [ ] **Step 8: Implement `app/api/admin/suppliers/[id]/route.ts`**

```ts
// app/api/admin/suppliers/[id]/route.ts
import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { parseSupplierInput } from "@/lib/supplier-input";

type RouteContext = { params: Promise<{ id: string }> };

function isUniqueViolation(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === "P2002";
}

export async function PATCH(req: Request, ctx: RouteContext) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await ctx.params;
  const parsed = parseSupplierInput(await req.json().catch(() => null));
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  try {
    const updated = await db.supplier.update({ where: { id }, data: parsed.data });
    return NextResponse.json(updated);
  } catch (error) {
    if (isUniqueViolation(error)) {
      return NextResponse.json({ error: `"${parsed.data.name}" already exists` }, { status: 409 });
    }
    if ((error as { code?: string } | null)?.code === "P2025") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    throw error;
  }
}

// Guarded like Label/Genre/ProductType/Artist: a supplier with any supply
// orders (any status — history shouldn't dangle a deleted supplier) can't be
// deleted.
export async function DELETE(_req: Request, ctx: RouteContext) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await ctx.params;
  const supplier = await db.supplier.findUnique({
    where: { id },
    include: { _count: { select: { supplyOrders: true } } },
  });
  if (!supplier) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (supplier._count.supplyOrders > 0) {
    return NextResponse.json(
      { error: `In use by ${supplier._count.supplyOrders} supply order(s)`, count: supplier._count.supplyOrders },
      { status: 409 },
    );
  }
  await db.supplier.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 9: Run to verify it passes**

Use the `run-tests` skill. Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add lib/supplier-input.ts lib/supplier-input.test.ts app/api/admin/suppliers
git commit -m "feat: add Supplier CRUD API routes"
```

---

## Task 11: Supplier admin UI

**Files:**
- Create: `components/admin/SupplierForm.tsx`
- Test: `components/admin/SupplierForm.test.tsx`
- Create: `app/admin/settings/suppliers/page.tsx`
- Test: `app/admin/settings/suppliers/suppliers-page.test.tsx`
- Create: `app/admin/settings/suppliers/new/page.tsx`
- Create: `app/admin/settings/suppliers/[id]/edit/page.tsx`
- Modify: `app/admin/settings/layout.tsx`

**Interfaces:**
- Consumes: `DeleteButton` (`components/admin/DeleteButton.tsx`, already exists — reused unmodified) for the delete-with-guard-error UI.

- [ ] **Step 1: Write the failing `SupplierForm` test**

```tsx
// components/admin/SupplierForm.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));

import { SupplierForm } from "@/components/admin/SupplierForm";

beforeEach(() => vi.clearAllMocks());

describe("SupplierForm", () => {
  it("renders name and contact fields", () => {
    render(<SupplierForm />);
    expect(screen.getByRole("textbox", { name: /name/i })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /contact/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /create supplier/i })).toBeInTheDocument();
  });

  it("submits and returns to the supplier list", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) }));

    render(<SupplierForm />);
    await user.type(screen.getByRole("textbox", { name: /name/i }), "Kalahari Oyster Cult");
    await user.click(screen.getByRole("button", { name: /create supplier/i }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/admin/settings/suppliers"));
  });

  it("edit mode PATCHes the existing supplier and shows 'Save changes'", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    vi.stubGlobal("fetch", fetchMock);

    render(<SupplierForm supplier={{ id: "s1", name: "X", contact: "ask Jules" }} />);
    expect(screen.getByRole("button", { name: /save changes/i })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/admin/suppliers/s1",
        expect.objectContaining({ method: "PATCH" }),
      ),
    );
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Use the `run-tests` skill. Expected: FAIL — component doesn't exist.

- [ ] **Step 3: Implement `SupplierForm.tsx`**

```tsx
// components/admin/SupplierForm.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { apiSend } from "@/lib/api-client";
import { useAsyncAction } from "@/lib/use-async-action";
import { Field } from "@/components/admin/Field";

export interface SupplierFormValues {
  id: string;
  name: string;
  contact: string | null;
}

export function SupplierForm({ supplier }: { supplier?: SupplierFormValues }) {
  const router = useRouter();
  const { pending: saving, error, run } = useAsyncAction();
  const [name, setName] = useState(supplier?.name ?? "");
  const [contact, setContact] = useState(supplier?.contact ?? "");

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    run(async () => {
      await apiSend(supplier ? `/api/admin/suppliers/${supplier.id}` : "/api/admin/suppliers", {
        method: supplier ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, contact }),
      });
      router.push("/admin/settings/suppliers");
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-xl space-y-4">
      <Field label="Name" htmlFor="supplier-name">
        <input
          id="supplier-name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded border border-admin-hairline px-2 py-1 text-sm"
        />
      </Field>

      <Field label="Contact (optional)" htmlFor="supplier-contact">
        <textarea
          id="supplier-contact"
          rows={2}
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          className="w-full rounded border border-admin-hairline px-2 py-1 text-sm"
        />
      </Field>

      {error && (
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded bg-admin-ink transition-colors duration-150 ease-out hover:bg-signal px-4 py-2 text-sm font-medium text-admin-bg disabled:opacity-60"
        >
          {saving ? "Saving…" : supplier ? "Save changes" : "Create supplier"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/admin/settings/suppliers")}
          className="rounded border border-admin-hairline px-4 py-2 text-sm"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Use the `run-tests` skill. Expected: PASS.

- [ ] **Step 5: Write the failing suppliers list-page test**

```tsx
// app/admin/settings/suppliers/suppliers-page.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/lib/db", () => ({ db: { supplier: { findMany: vi.fn() } } }));

import AdminSuppliersPage from "@/app/admin/settings/suppliers/page";
import { db } from "@/lib/db";

beforeEach(() => vi.clearAllMocks());

describe("/admin/settings/suppliers", () => {
  it("lists suppliers with contact and order count", async () => {
    vi.mocked(db.supplier.findMany).mockResolvedValue([
      { id: "s1", name: "Kalahari Oyster Cult", contact: "ask Jules", _count: { supplyOrders: 3 } },
    ] as never);
    render(await AdminSuppliersPage());
    expect(screen.getByText("Kalahari Oyster Cult")).toBeInTheDocument();
    expect(screen.getByText("ask Jules")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("shows a placeholder with no suppliers", async () => {
    vi.mocked(db.supplier.findMany).mockResolvedValue([] as never);
    render(await AdminSuppliersPage());
    expect(screen.getByText(/no suppliers yet/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 6: Run to verify it fails**

Use the `run-tests` skill. Expected: FAIL — page doesn't exist.

- [ ] **Step 7: Implement the pages**

```tsx
// app/admin/settings/suppliers/page.tsx
import Link from "next/link";

import { db } from "@/lib/db";
import { DeleteButton } from "@/components/admin/DeleteButton";

export const dynamic = "force-dynamic";

export default async function AdminSuppliersPage() {
  const suppliers = await db.supplier.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { supplyOrders: true } } },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Suppliers</h1>
          <p className="text-sm text-admin-ink-muted">
            {suppliers.length} supplier{suppliers.length === 1 ? "" : "s"}
          </p>
        </div>
        <Link
          href="/admin/settings/suppliers/new"
          className="rounded bg-admin-ink transition-colors duration-150 ease-out hover:bg-signal px-3 py-2 text-sm font-medium text-admin-bg"
        >
          New supplier
        </Link>
      </div>

      {suppliers.length === 0 ? (
        <p className="rounded border border-dashed border-admin-hairline p-8 text-center text-admin-ink-muted">
          No suppliers yet.
        </p>
      ) : (
        <div className="overflow-x-auto rounded border border-admin-hairline bg-admin-surface">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-admin-hairline bg-admin-bg text-admin-ink-muted">
              <tr>
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Contact</th>
                <th className="px-3 py-2 font-medium">Orders</th>
                <th className="px-3 py-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-admin-hairline">
              {suppliers.map((supplier) => (
                <tr key={supplier.id}>
                  <td className="px-3 py-2">
                    <Link href={`/admin/settings/suppliers/${supplier.id}/edit`} className="hover:underline">
                      {supplier.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-admin-ink-muted">{supplier.contact ?? "—"}</td>
                  <td className="px-3 py-2">{supplier._count.supplyOrders}</td>
                  <td className="px-3 py-2 text-right">
                    <DeleteButton endpoint={`/api/admin/suppliers/${supplier.id}`} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

```tsx
// app/admin/settings/suppliers/new/page.tsx
import { SupplierForm } from "@/components/admin/SupplierForm";

export default function NewSupplierPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">New supplier</h1>
      <SupplierForm />
    </div>
  );
}
```

```tsx
// app/admin/settings/suppliers/[id]/edit/page.tsx
import { notFound } from "next/navigation";

import { db } from "@/lib/db";
import { SupplierForm } from "@/components/admin/SupplierForm";

export const dynamic = "force-dynamic";

export default async function EditSupplierPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supplier = await db.supplier.findUnique({ where: { id } });
  if (!supplier) notFound();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Edit supplier</h1>
      <SupplierForm supplier={{ id: supplier.id, name: supplier.name, contact: supplier.contact }} />
    </div>
  );
}
```

- [ ] **Step 8: Add Suppliers to the Settings sub-nav**

In `app/admin/settings/layout.tsx`, add to `ITEMS`:
```ts
  { href: "/admin/settings/suppliers", label: "Suppliers" },
```
(append after `"Users"`, matching the order things were added historically.)

- [ ] **Step 9: Run to verify it passes**

Use the `run-tests` skill. Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add components/admin/SupplierForm.tsx components/admin/SupplierForm.test.tsx app/admin/settings/suppliers app/admin/settings/layout.tsx
git commit -m "feat: add supplier admin UI"
```

---

## Task 12: Combobox — optional `allowCreate` (needed for the product-line picker)

**Files:**
- Modify: `components/ui/Combobox.tsx`
- Modify: `components/ui/Combobox.test.tsx`

**Interfaces:**
- Produces: `ComboboxProps.allowCreate?: boolean` (default `true` — every existing caller keeps today's quick-add behavior unchanged). When `false`, the "+ Add …" option never appears and Enter/click can't trigger a create.

This is a small, backward-compatible extension: Task 19's order-line product picker must not offer "+ Add" (there's no such thing as quick-adding a full Product from a name string — it needs label/genre/type/price), and Combobox is otherwise exactly the right widget.

- [ ] **Step 1: Read the existing `Combobox.test.tsx` to confirm no test asserts the ABSENCE of a way to disable quick-add**

(No code change in this step — just confirms the new test is additive, not a rewrite of an existing case.)

- [ ] **Step 2: Add the failing test**

Append to `components/ui/Combobox.test.tsx`:
```tsx
  it("hides the quick-add option when allowCreate is false", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => [] }));

    render(
      <Combobox label="Product" endpoint="/api/admin/products/search" value={null} onChange={vi.fn()} allowCreate={false} />,
    );
    await user.click(screen.getByRole("combobox"));
    await user.type(screen.getByRole("combobox"), "Nonexistent Record");

    await screen.findByRole("combobox");
    expect(screen.queryByText(/\+ add/i)).toBeNull();
  });
```

(Match the existing file's import style for `userEvent`/`vi`/`render`/`screen` — check the top of `Combobox.test.tsx` before adding and reuse whatever's already imported there rather than re-importing.)

- [ ] **Step 3: Run to verify it fails**

Use the `run-tests` skill. Expected: FAIL — `allowCreate` prop doesn't exist, quick-add always shows for a non-matching query.

- [ ] **Step 4: Edit `Combobox.tsx`**

Add to `ComboboxProps`:
```ts
  // Hides the "+ Add …" quick-create option. Default true (existing
  // behavior) — set false for pickers over entities that can't be
  // meaningfully created from just a name (e.g. Product).
  allowCreate?: boolean;
```

Destructure with a default in the component signature: `allowCreate = true,`.

Change:
```ts
  const showQuickAdd = filter.length > 0 && !hasExact;
```
to:
```ts
  const showQuickAdd = allowCreate && filter.length > 0 && !hasExact;
```

- [ ] **Step 5: Run to verify it passes**

Use the `run-tests` skill on `components/ui/Combobox.test.tsx` (the whole file, to confirm nothing existing broke). Expected: PASS, including all pre-existing cases.

- [ ] **Step 6: Commit**

```bash
git add components/ui/Combobox.tsx components/ui/Combobox.test.tsx
git commit -m "feat: add Combobox allowCreate prop for non-creatable pickers"
```

---

## Task 13: Product search endpoint (for the order-line picker)

**Files:**
- Create: `app/api/admin/products/search/route.ts`
- Test: `app/api/admin/products/search/route.test.ts`

**Interfaces:**
- Produces: `GET ?q=` → `{ id, name }[]` where `name` is `"${primaryArtistName} — ${title}"` (Product has no `name` column, so this is a display-name adapter matching the `ComboboxOption` contract).

- [ ] **Step 1: Write the failing test**

```ts
// app/api/admin/products/search/route.test.ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api-auth", () => ({ requireAdmin: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/db", () => ({ db: { product: { findMany: vi.fn() } } }));

import { GET } from "@/app/api/admin/products/search/route";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/api-auth";

const mockRequireAdmin = vi.mocked(requireAdmin);

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAdmin.mockResolvedValue(null);
});

describe("GET /api/admin/products/search", () => {
  it("maps title/primaryArtistName into a single display name", async () => {
    vi.mocked(db.product.findMany).mockResolvedValue([
      { id: "p1", title: "Torus", primaryArtistName: "Vril" },
    ] as never);
    const res = await GET(new Request("http://t/api/admin/products/search?q=torus"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([{ id: "p1", name: "Vril — Torus" }]);
    expect(db.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 20, orderBy: { title: "asc" } }),
    );
  });

  it("returns the 401 from requireAdmin without querying", async () => {
    mockRequireAdmin.mockResolvedValue(new Response(null, { status: 401 }) as never);
    const res = await GET(new Request("http://t/api/admin/products/search"));
    expect(res.status).toBe(401);
    expect(db.product.findMany).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Use the `run-tests` skill. Expected: FAIL — route doesn't exist.

- [ ] **Step 3: Implement the route**

```ts
// app/api/admin/products/search/route.ts
import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";

const SEARCH_LIMIT = 20;

// Typeahead for product pickers (e.g. supply order lines). Product has no
// `name` column, so results are mapped to { id, name } with a synthesized
// display name — same { id, name } contract the reference lists use, so
// Combobox works against this route unmodified (aside from allowCreate).
export async function GET(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  const products = await db.product.findMany({
    where: q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { primaryArtistName: { contains: q, mode: "insensitive" } },
          ],
        }
      : undefined,
    orderBy: { title: "asc" },
    take: SEARCH_LIMIT,
    select: { id: true, title: true, primaryArtistName: true },
  });
  return NextResponse.json(
    products.map((p) => ({ id: p.id, name: `${p.primaryArtistName} — ${p.title}` })),
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Use the `run-tests` skill. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/products/search
git commit -m "feat: add product search endpoint for the order-line picker"
```

---

## Task 14: Supply order input parsing

**Files:**
- Create: `lib/supply-order-input.ts`
- Test: `lib/supply-order-input.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface SupplyOrderLineInput { productId: string; quantityOrdered: number; }
  export interface SupplyOrderInput {
    supplierId: string;
    reference: string | null;
    notes: string | null;
    orderedAt: string; // ISO datetime
    lines: SupplyOrderLineInput[];
  }
  export function parseSupplyOrderInput(body: unknown): { ok: true; data: SupplyOrderInput } | { ok: false; error: string };
  ```
  Consumed by Tasks 15 and 16.

- [ ] **Step 1: Write the failing test**

```ts
// lib/supply-order-input.test.ts
import { describe, it, expect } from "vitest";

import { parseSupplyOrderInput } from "@/lib/supply-order-input";

const VALID = {
  supplierId: "s1",
  reference: "PO-123",
  notes: "call ahead",
  orderedAt: "2026-07-29T10:00",
  lines: [{ productId: "p1", quantityOrdered: 5 }],
};

describe("parseSupplyOrderInput", () => {
  it("accepts and normalizes valid input", () => {
    const result = parseSupplyOrderInput(VALID);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.supplierId).toBe("s1");
    expect(result.data.reference).toBe("PO-123");
    expect(result.data.lines).toEqual([{ productId: "p1", quantityOrdered: 5 }]);
  });

  it("defaults orderedAt to now when absent", () => {
    const { orderedAt, ...rest } = VALID;
    void orderedAt;
    const result = parseSupplyOrderInput(rest);
    expect(result.ok).toBe(true);
  });

  it("nullifies blank reference/notes", () => {
    const result = parseSupplyOrderInput({ ...VALID, reference: "", notes: "  " });
    expect(result.ok && result.data.reference).toBeNull();
    expect(result.ok && result.data.notes).toBeNull();
  });

  it("rejects a missing supplierId", () => {
    expect(parseSupplyOrderInput({ ...VALID, supplierId: "" }).ok).toBe(false);
  });

  it("rejects an empty lines array", () => {
    expect(parseSupplyOrderInput({ ...VALID, lines: [] }).ok).toBe(false);
  });

  it("rejects a line with a non-positive quantity", () => {
    expect(parseSupplyOrderInput({ ...VALID, lines: [{ productId: "p1", quantityOrdered: 0 }] }).ok).toBe(false);
    expect(parseSupplyOrderInput({ ...VALID, lines: [{ productId: "p1", quantityOrdered: -1 }] }).ok).toBe(false);
  });

  it("rejects a duplicate product across lines", () => {
    const result = parseSupplyOrderInput({
      ...VALID,
      lines: [
        { productId: "p1", quantityOrdered: 1 },
        { productId: "p1", quantityOrdered: 2 },
      ],
    });
    expect(result.ok).toBe(false);
  });

  it("rejects an invalid orderedAt", () => {
    expect(parseSupplyOrderInput({ ...VALID, orderedAt: "not-a-date" }).ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Use the `run-tests` skill. Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement `lib/supply-order-input.ts`**

```ts
// lib/supply-order-input.ts
export interface SupplyOrderLineInput {
  productId: string;
  quantityOrdered: number;
}

export interface SupplyOrderInput {
  supplierId: string;
  reference: string | null;
  notes: string | null;
  orderedAt: string;
  lines: SupplyOrderLineInput[];
}

export type ParseResult = { ok: true; data: SupplyOrderInput } | { ok: false; error: string };

// A product can only appear once per order (mirrors the schema's
// @@unique([supplyOrderId, productId])) — ordering more later means a new
// line on a still-editable PENDING order, or a new order.
function parseLines(v: unknown): SupplyOrderLineInput[] | null {
  if (!Array.isArray(v) || v.length === 0) return null;
  const lines: SupplyOrderLineInput[] = [];
  const seen = new Set<string>();
  for (const item of v) {
    const l = (item ?? {}) as Record<string, unknown>;
    const productId = typeof l.productId === "string" ? l.productId.trim() : "";
    if (!productId || seen.has(productId)) return null;
    seen.add(productId);
    const qty = typeof l.quantityOrdered === "number" ? l.quantityOrdered : NaN;
    if (!Number.isInteger(qty) || qty <= 0) return null;
    lines.push({ productId, quantityOrdered: qty });
  }
  return lines;
}

export function parseSupplyOrderInput(body: unknown): ParseResult {
  const b = (body ?? {}) as Record<string, unknown>;

  const supplierId = typeof b.supplierId === "string" ? b.supplierId.trim() : "";
  if (!supplierId) return { ok: false, error: "Supplier is required" };

  const lines = parseLines(b.lines);
  if (!lines) {
    return {
      ok: false,
      error: "At least one order line with a valid, non-duplicate product and a positive quantity is required",
    };
  }

  const orderedAtRaw = typeof b.orderedAt === "string" ? b.orderedAt.trim() : "";
  const orderedAt = orderedAtRaw ? new Date(orderedAtRaw) : new Date();
  if (Number.isNaN(orderedAt.getTime())) {
    return { ok: false, error: "Ordered date is invalid" };
  }

  const reference = typeof b.reference === "string" ? b.reference.trim() : "";
  const notes = typeof b.notes === "string" ? b.notes.trim() : "";

  return {
    ok: true,
    data: {
      supplierId,
      reference: reference || null,
      notes: notes || null,
      orderedAt: orderedAt.toISOString(),
      lines,
    },
  };
}
```

- [ ] **Step 4: Run to verify it passes**

Use the `run-tests` skill. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/supply-order-input.ts lib/supply-order-input.test.ts
git commit -m "feat: add supply order input parsing"
```

---

## Task 15: Orders collection route (list + create)

**Files:**
- Create: `app/api/admin/orders/route.ts`
- Test: `app/api/admin/orders/orders.test.ts`

**Interfaces:**
- Consumes: `parseSupplyOrderInput` (Task 14).
- Produces: `GET` → all orders with `supplier`+`lines`, newest-`orderedAt`-first. `POST` → 201 created order (status defaults `PENDING` per schema).

- [ ] **Step 1: Write the failing test**

```ts
// app/api/admin/orders/orders.test.ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

vi.mock("@/lib/api-auth", () => ({ requireAdmin: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/db", () => ({ db: { supplyOrder: { findMany: vi.fn(), create: vi.fn() } } }));

import { db } from "@/lib/db";
import { GET, POST } from "@/app/api/admin/orders/route";
import { requireAdmin } from "@/lib/api-auth";

const order = db.supplyOrder as unknown as { findMany: Mock; create: Mock };
const mockRequireAdmin = vi.mocked(requireAdmin);
const req = (body: unknown) =>
  new Request("http://t/api/admin/orders", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

const VALID = {
  supplierId: "s1",
  reference: "PO-1",
  notes: null,
  orderedAt: "2026-07-29T10:00",
  lines: [{ productId: "p1", quantityOrdered: 5 }],
};

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAdmin.mockResolvedValue(null);
});

describe("GET /api/admin/orders", () => {
  it("returns orders newest orderedAt first", async () => {
    order.findMany.mockResolvedValue([]);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { orderedAt: "desc" } }),
    );
  });
});

describe("POST /api/admin/orders", () => {
  it("creates an order with nested lines (201)", async () => {
    order.create.mockResolvedValue({ id: "o1" });
    const res = await POST(req(VALID));
    expect(res.status).toBe(201);
    expect(order.create.mock.calls[0][0].data).toMatchObject({
      supplierId: "s1",
      reference: "PO-1",
      lines: { create: [{ productId: "p1", quantityOrdered: 5 }] },
    });
  });

  it("400s invalid input without writing", async () => {
    const res = await POST(req({ ...VALID, lines: [] }));
    expect(res.status).toBe(400);
    expect(order.create).not.toHaveBeenCalled();
  });

  it("400s when the supplier or a product no longer exists (P2025)", async () => {
    order.create.mockRejectedValue({ code: "P2025" });
    const res = await POST(req(VALID));
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Use the `run-tests` skill. Expected: FAIL — route doesn't exist.

- [ ] **Step 3: Implement the route**

```ts
// app/api/admin/orders/route.ts
import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { parseSupplyOrderInput } from "@/lib/supply-order-input";

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  const orders = await db.supplyOrder.findMany({
    orderBy: { orderedAt: "desc" },
    include: { supplier: true, lines: true },
  });
  return NextResponse.json(orders);
}

export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const parsed = parseSupplyOrderInput(await req.json().catch(() => null));
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  try {
    const created = await db.supplyOrder.create({
      data: {
        supplierId: parsed.data.supplierId,
        reference: parsed.data.reference,
        notes: parsed.data.notes,
        orderedAt: new Date(parsed.data.orderedAt),
        lines: {
          create: parsed.data.lines.map((line) => ({
            productId: line.productId,
            quantityOrdered: line.quantityOrdered,
          })),
        },
      },
      include: { supplier: true, lines: true },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    if ((error as { code?: string } | null)?.code === "P2025") {
      return NextResponse.json(
        { error: "Selected supplier or product no longer exists" },
        { status: 400 },
      );
    }
    throw error;
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Use the `run-tests` skill. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/orders/route.ts app/api/admin/orders/orders.test.ts
git commit -m "feat: add supply order list/create route"
```

---

## Task 16: Order item route (get/edit/delete, guarded to PENDING)

**Files:**
- Create: `app/api/admin/orders/[id]/route.ts`
- Test: `app/api/admin/orders/[id]/route.test.ts`

**Interfaces:**
- `PATCH`/`DELETE` both 409 when `status !== "PENDING"`. `PATCH` replaces the line set (delete-all-then-recreate, same shape as `toProductData`'s artist replacement).

- [ ] **Step 1: Write the failing test**

```ts
// app/api/admin/orders/[id]/route.test.ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

vi.mock("@/lib/api-auth", () => ({ requireAdmin: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/db", () => ({
  db: { supplyOrder: { findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() } },
}));

import { db } from "@/lib/db";
import { GET, PATCH, DELETE } from "@/app/api/admin/orders/[id]/route";
import { requireAdmin } from "@/lib/api-auth";

const order = db.supplyOrder as unknown as { findUnique: Mock; update: Mock; delete: Mock };
const mockRequireAdmin = vi.mocked(requireAdmin);
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const patchReq = (body: unknown) =>
  new Request("http://t/x", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
const getReq = () => new Request("http://t/x");
const delReq = () => new Request("http://t/x", { method: "DELETE" });

const VALID = {
  supplierId: "s1",
  reference: "PO-1",
  notes: null,
  orderedAt: "2026-07-29T10:00",
  lines: [{ productId: "p1", quantityOrdered: 5 }],
};

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAdmin.mockResolvedValue(null);
});

describe("GET /api/admin/orders/[id]", () => {
  it("404s an unknown order", async () => {
    order.findUnique.mockResolvedValue(null);
    const res = await GET(getReq(), ctx("missing"));
    expect(res.status).toBe(404);
  });
});

describe("PATCH /api/admin/orders/[id]", () => {
  it("replaces the line set on a PENDING order", async () => {
    order.findUnique.mockResolvedValue({ id: "o1", status: "PENDING" });
    order.update.mockResolvedValue({ id: "o1" });
    const res = await PATCH(patchReq(VALID), ctx("o1"));
    expect(res.status).toBe(200);
    expect(order.update.mock.calls[0][0].data.lines).toEqual({
      deleteMany: {},
      create: [{ productId: "p1", quantityOrdered: 5 }],
    });
  });

  it("409s a non-PENDING order without writing", async () => {
    order.findUnique.mockResolvedValue({ id: "o1", status: "PARTIAL" });
    const res = await PATCH(patchReq(VALID), ctx("o1"));
    expect(res.status).toBe(409);
    expect(order.update).not.toHaveBeenCalled();
  });

  it("404s an unknown order", async () => {
    order.findUnique.mockResolvedValue(null);
    const res = await PATCH(patchReq(VALID), ctx("missing"));
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/admin/orders/[id]", () => {
  it("deletes a PENDING order", async () => {
    order.findUnique.mockResolvedValue({ id: "o1", status: "PENDING" });
    order.delete.mockResolvedValue({ id: "o1" });
    const res = await DELETE(delReq(), ctx("o1"));
    expect(res.status).toBe(200);
  });

  it("409s a non-PENDING order without deleting", async () => {
    order.findUnique.mockResolvedValue({ id: "o1", status: "RECEIVED" });
    const res = await DELETE(delReq(), ctx("o1"));
    expect(res.status).toBe(409);
    expect(order.delete).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Use the `run-tests` skill. Expected: FAIL — route doesn't exist.

- [ ] **Step 3: Implement the route**

```ts
// app/api/admin/orders/[id]/route.ts
import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { parseSupplyOrderInput } from "@/lib/supply-order-input";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: RouteContext) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await ctx.params;
  const order = await db.supplyOrder.findUnique({
    where: { id },
    include: { supplier: true, lines: { include: { product: true } } },
  });
  if (!order) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(order);
}

export async function PATCH(req: Request, ctx: RouteContext) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await ctx.params;

  const existing = await db.supplyOrder.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (existing.status !== "PENDING") {
    return NextResponse.json({ error: "Only a pending order can be edited" }, { status: 409 });
  }

  const parsed = parseSupplyOrderInput(await req.json().catch(() => null));
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const updated = await db.supplyOrder.update({
      where: { id },
      data: {
        supplierId: parsed.data.supplierId,
        reference: parsed.data.reference,
        notes: parsed.data.notes,
        orderedAt: new Date(parsed.data.orderedAt),
        lines: {
          deleteMany: {},
          create: parsed.data.lines.map((line) => ({
            productId: line.productId,
            quantityOrdered: line.quantityOrdered,
          })),
        },
      },
      include: { supplier: true, lines: true },
    });
    return NextResponse.json(updated);
  } catch (error) {
    if ((error as { code?: string } | null)?.code === "P2025") {
      return NextResponse.json(
        { error: "Selected supplier or product no longer exists" },
        { status: 400 },
      );
    }
    throw error;
  }
}

export async function DELETE(_req: Request, ctx: RouteContext) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await ctx.params;
  const existing = await db.supplyOrder.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (existing.status !== "PENDING") {
    return NextResponse.json({ error: "Only a pending order can be deleted" }, { status: 409 });
  }
  await db.supplyOrder.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Run to verify it passes**

Use the `run-tests` skill. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/orders/[id]/route.ts app/api/admin/orders/[id]/route.test.ts
git commit -m "feat: add supply order get/edit/delete route, guarded to PENDING"
```

---

## Task 17: Receive route

**Files:**
- Create: `lib/supply-order-receive-input.ts`
- Test: `lib/supply-order-receive-input.test.ts`
- Create: `app/api/admin/orders/[id]/receive/route.ts`
- Test: `app/api/admin/orders/[id]/receive/route.test.ts`

**Interfaces:**
- Consumes: `applyStockTransaction` (Task 2).
- Produces: `parseReceiveInput(body): { ok: true; data: { lines: { supplyOrderLineId: string; receiveNow: number }[] } } | { ok: false; error: string }`. Route recomputes order status (`RECEIVED` if every line is fully received, else `PARTIAL`) and bumps `receivedAt` to now on every call — supports receiving a `PARTIAL` order again for the remainder.

- [ ] **Step 1: Write the failing lib test**

```ts
// lib/supply-order-receive-input.test.ts
import { describe, it, expect } from "vitest";

import { parseReceiveInput } from "@/lib/supply-order-receive-input";

describe("parseReceiveInput", () => {
  it("accepts one or more lines", () => {
    const result = parseReceiveInput({ lines: [{ supplyOrderLineId: "l1", receiveNow: 3 }] });
    expect(result).toEqual({ ok: true, data: { lines: [{ supplyOrderLineId: "l1", receiveNow: 3 }] } });
  });

  it("accepts receiveNow: 0 (caller filters no-ops, not the parser)", () => {
    const result = parseReceiveInput({ lines: [{ supplyOrderLineId: "l1", receiveNow: 0 }] });
    expect(result.ok).toBe(true);
  });

  it("rejects an empty lines array", () => {
    expect(parseReceiveInput({ lines: [] }).ok).toBe(false);
  });

  it("rejects a negative receiveNow", () => {
    expect(parseReceiveInput({ lines: [{ supplyOrderLineId: "l1", receiveNow: -1 }] }).ok).toBe(false);
  });

  it("rejects a non-integer receiveNow", () => {
    expect(parseReceiveInput({ lines: [{ supplyOrderLineId: "l1", receiveNow: 1.5 }] }).ok).toBe(false);
  });

  it("rejects a missing supplyOrderLineId", () => {
    expect(parseReceiveInput({ lines: [{ receiveNow: 1 }] }).ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Use the `run-tests` skill. Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement `lib/supply-order-receive-input.ts`**

```ts
// lib/supply-order-receive-input.ts
export interface ReceiveLineInput {
  supplyOrderLineId: string;
  receiveNow: number;
}

export interface ReceiveInput {
  lines: ReceiveLineInput[];
}

export type ParseResult = { ok: true; data: ReceiveInput } | { ok: false; error: string };

// receiveNow is THIS event's increment, not a new total — avoids re-entering
// already-received counts on a second (partial) receive.
export function parseReceiveInput(body: unknown): ParseResult {
  const b = (body ?? {}) as Record<string, unknown>;
  if (!Array.isArray(b.lines) || b.lines.length === 0) {
    return { ok: false, error: "At least one line is required" };
  }
  const lines: ReceiveLineInput[] = [];
  for (const item of b.lines) {
    const l = (item ?? {}) as Record<string, unknown>;
    const supplyOrderLineId = typeof l.supplyOrderLineId === "string" ? l.supplyOrderLineId.trim() : "";
    if (!supplyOrderLineId) return { ok: false, error: "Each line needs a supplyOrderLineId" };
    const receiveNow = typeof l.receiveNow === "number" ? l.receiveNow : NaN;
    if (!Number.isInteger(receiveNow) || receiveNow < 0) {
      return { ok: false, error: "receiveNow must be a non-negative whole number" };
    }
    lines.push({ supplyOrderLineId, receiveNow });
  }
  return { ok: true, data: { lines } };
}
```

- [ ] **Step 4: Run to verify it passes**

Use the `run-tests` skill. Expected: PASS.

- [ ] **Step 5: Write the failing route test**

```ts
// app/api/admin/orders/[id]/receive/route.test.ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

vi.mock("@/lib/api-auth", () => ({ requireAdmin: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/stock", () => ({ applyStockTransaction: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: {
    supplyOrder: { findUnique: vi.fn(), update: vi.fn() },
    supplyOrderLine: { update: vi.fn(), findMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import { db } from "@/lib/db";
import { applyStockTransaction } from "@/lib/stock";
import { POST } from "@/app/api/admin/orders/[id]/receive/route";
import { requireAdmin } from "@/lib/api-auth";

const supplyOrder = db.supplyOrder as unknown as { findUnique: Mock; update: Mock };
const supplyOrderLine = db.supplyOrderLine as unknown as { update: Mock; findMany: Mock };
const mockTransaction = db.$transaction as unknown as Mock;
const mockApply = applyStockTransaction as unknown as Mock;
const mockRequireAdmin = vi.mocked(requireAdmin);
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const req = (body: unknown) =>
  new Request("http://t/x", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

const LINE = { id: "l1", productId: "p1", quantityOrdered: 5, quantityReceived: 0 };

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAdmin.mockResolvedValue(null);
  mockTransaction.mockImplementation((fn: (tx: unknown) => unknown) => fn({}));
});

describe("POST /api/admin/orders/[id]/receive", () => {
  it("applies an IN transaction per received line and sets status PARTIAL when under-received", async () => {
    supplyOrder.findUnique.mockResolvedValue({ id: "o1", status: "PENDING", lines: [LINE] });
    mockApply.mockResolvedValue({ ok: true, quantity: 3, appliedQuantity: 3 });
    supplyOrderLine.update.mockResolvedValue({});
    supplyOrderLine.findMany.mockResolvedValue([{ ...LINE, quantityReceived: 3 }]);
    supplyOrder.update.mockResolvedValue({ id: "o1", status: "PARTIAL" });

    const res = await POST(req({ lines: [{ supplyOrderLineId: "l1", receiveNow: 3 }] }), ctx("o1"));

    expect(res.status).toBe(200);
    expect(mockApply).toHaveBeenCalledWith(expect.anything(), {
      productId: "p1",
      type: "IN",
      requestedQuantity: 3,
      note: "Received from supply order",
      supplyOrderLineId: "l1",
    });
    expect(supplyOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "PARTIAL" }) }),
    );
  });

  it("sets status RECEIVED once every line is fully received", async () => {
    supplyOrder.findUnique.mockResolvedValue({ id: "o1", status: "PARTIAL", lines: [LINE] });
    mockApply.mockResolvedValue({ ok: true, quantity: 5, appliedQuantity: 5 });
    supplyOrderLine.update.mockResolvedValue({});
    supplyOrderLine.findMany.mockResolvedValue([{ ...LINE, quantityReceived: 5 }]);
    supplyOrder.update.mockResolvedValue({ id: "o1", status: "RECEIVED" });

    const res = await POST(req({ lines: [{ supplyOrderLineId: "l1", receiveNow: 5 }] }), ctx("o1"));

    expect(res.status).toBe(200);
    expect(supplyOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "RECEIVED" }) }),
    );
  });

  it("400s receiving more than was ordered", async () => {
    supplyOrder.findUnique.mockResolvedValue({ id: "o1", status: "PENDING", lines: [LINE] });
    const res = await POST(req({ lines: [{ supplyOrderLineId: "l1", receiveNow: 6 }] }), ctx("o1"));
    expect(res.status).toBe(400);
    expect(mockApply).not.toHaveBeenCalled();
  });

  it("400s when nothing in the payload has receiveNow > 0", async () => {
    supplyOrder.findUnique.mockResolvedValue({ id: "o1", status: "PENDING", lines: [LINE] });
    const res = await POST(req({ lines: [{ supplyOrderLineId: "l1", receiveNow: 0 }] }), ctx("o1"));
    expect(res.status).toBe(400);
  });

  it("409s an already-RECEIVED order", async () => {
    supplyOrder.findUnique.mockResolvedValue({ id: "o1", status: "RECEIVED", lines: [LINE] });
    const res = await POST(req({ lines: [{ supplyOrderLineId: "l1", receiveNow: 1 }] }), ctx("o1"));
    expect(res.status).toBe(409);
  });

  it("404s an unknown order", async () => {
    supplyOrder.findUnique.mockResolvedValue(null);
    const res = await POST(req({ lines: [{ supplyOrderLineId: "l1", receiveNow: 1 }] }), ctx("missing"));
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 6: Run to verify it fails**

Use the `run-tests` skill. Expected: FAIL — route doesn't exist.

- [ ] **Step 7: Implement the route**

```ts
// app/api/admin/orders/[id]/receive/route.ts
import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { applyStockTransaction } from "@/lib/stock";
import { parseReceiveInput } from "@/lib/supply-order-receive-input";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: RouteContext) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await ctx.params;

  const parsed = parseReceiveInput(await req.json().catch(() => null));
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const order = await db.supplyOrder.findUnique({ where: { id }, include: { lines: true } });
  if (!order) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (order.status === "RECEIVED") {
    return NextResponse.json({ error: "This order has already been fully received" }, { status: 409 });
  }

  const linesById = new Map(order.lines.map((l) => [l.id, l]));
  for (const entry of parsed.data.lines) {
    const line = linesById.get(entry.supplyOrderLineId);
    if (!line) {
      return NextResponse.json({ error: "Unknown order line" }, { status: 400 });
    }
    if (line.quantityReceived + entry.receiveNow > line.quantityOrdered) {
      return NextResponse.json(
        { error: `Cannot receive more than ordered for line ${line.id}` },
        { status: 400 },
      );
    }
  }

  const toApply = parsed.data.lines.filter((e) => e.receiveNow > 0);
  if (toApply.length === 0) {
    return NextResponse.json({ error: "Nothing to receive" }, { status: 400 });
  }

  let updatedOrder;
  try {
    updatedOrder = await db.$transaction(async (tx) => {
      for (const entry of toApply) {
        const line = linesById.get(entry.supplyOrderLineId)!;
        const result = await applyStockTransaction(tx, {
          productId: line.productId,
          type: "IN",
          requestedQuantity: entry.receiveNow,
          note: "Received from supply order",
          supplyOrderLineId: line.id,
        });
        if (!result.ok) throw new Error(result.error);

        await tx.supplyOrderLine.update({
          where: { id: line.id },
          data: { quantityReceived: { increment: entry.receiveNow } },
        });
      }

      const freshLines = await tx.supplyOrderLine.findMany({ where: { supplyOrderId: id } });
      const fullyReceived = freshLines.every((l) => l.quantityReceived >= l.quantityOrdered);

      return tx.supplyOrder.update({
        where: { id },
        data: { status: fullyReceived ? "RECEIVED" : "PARTIAL", receivedAt: new Date() },
        include: { supplier: true, lines: true },
      });
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to receive order" },
      { status: 400 },
    );
  }

  return NextResponse.json(updatedOrder);
}
```

- [ ] **Step 8: Run to verify it passes**

Use the `run-tests` skill. Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add lib/supply-order-receive-input.ts lib/supply-order-receive-input.test.ts app/api/admin/orders/[id]/receive
git commit -m "feat: add supply order receive route (supports re-receiving a PARTIAL order)"
```

---

## Task 18: OrderForm component (create + edit)

**Files:**
- Create: `components/admin/OrderForm.tsx`
- Test: `components/admin/OrderForm.test.tsx`

**Interfaces:**
- Consumes: `Combobox` (with `allowCreate={false}` for lines, default for supplier) from Tasks 12/13.
- Produces: `OrderForm({ order?: OrderFormValues })`.

- [ ] **Step 1: Write the failing test**

```tsx
// components/admin/OrderForm.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));

import { OrderForm } from "@/components/admin/OrderForm";

beforeEach(() => vi.clearAllMocks());

describe("OrderForm", () => {
  it("renders supplier, dates, notes and one starter line", () => {
    render(<OrderForm />);
    expect(screen.getByRole("combobox", { name: /supplier/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/ordered at/i)).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /product 1/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /create order/i })).toBeInTheDocument();
  });

  it("adds and removes lines", async () => {
    const user = userEvent.setup();
    render(<OrderForm />);
    await user.click(screen.getByRole("button", { name: /add line/i }));
    expect(screen.getByRole("combobox", { name: /product 2/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /remove line 2/i }));
    expect(screen.queryByRole("combobox", { name: /product 2/i })).toBeNull();
  });

  it("the sole remaining line can't be removed", () => {
    render(<OrderForm />);
    expect(screen.getByRole("button", { name: /remove line 1/i })).toBeDisabled();
  });

  it("edit mode PATCHes the existing order and shows 'Save changes'", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <OrderForm
        order={{
          id: "o1",
          supplier: { id: "s1", name: "Kalahari Oyster Cult" },
          reference: "PO-1",
          notes: null,
          orderedAt: "2026-07-29T10:00",
          lines: [{ product: { id: "p1", name: "Vril — Torus" }, quantityOrdered: 5 }],
        }}
      />,
    );
    expect(screen.getByRole("button", { name: /save changes/i })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/admin/orders/o1",
        expect.objectContaining({ method: "PATCH" }),
      ),
    );
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.lines).toEqual([{ productId: "p1", quantityOrdered: 5 }]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Use the `run-tests` skill. Expected: FAIL — component doesn't exist.

- [ ] **Step 3: Implement `OrderForm.tsx`**

```tsx
// components/admin/OrderForm.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { apiSend } from "@/lib/api-client";
import { useAsyncAction } from "@/lib/use-async-action";
import { Combobox, type ComboboxOption } from "@/components/ui/Combobox";
import { Field } from "@/components/admin/Field";

interface OrderLineValue {
  product: ComboboxOption | null;
  quantityOrdered: string;
}

export interface OrderFormValues {
  id: string;
  supplier: ComboboxOption;
  reference: string | null;
  notes: string | null;
  orderedAt: string; // datetime-local value
  lines: { product: ComboboxOption; quantityOrdered: number }[];
}

export function OrderForm({ order }: { order?: OrderFormValues }) {
  const router = useRouter();
  const { pending: saving, error, run } = useAsyncAction();
  const [supplier, setSupplier] = useState<ComboboxOption | null>(order?.supplier ?? null);
  const [reference, setReference] = useState(order?.reference ?? "");
  const [notes, setNotes] = useState(order?.notes ?? "");
  const [orderedAt, setOrderedAt] = useState(
    order?.orderedAt ?? new Date().toISOString().slice(0, 16),
  );
  const [lines, setLines] = useState<OrderLineValue[]>(
    order?.lines.map((l) => ({ product: l.product, quantityOrdered: String(l.quantityOrdered) })) ?? [
      { product: null, quantityOrdered: "1" },
    ],
  );

  function updateLine(index: number, patch: Partial<OrderLineValue>) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }
  function addLine() {
    setLines((prev) => [...prev, { product: null, quantityOrdered: "1" }]);
  }
  function removeLine(index: number) {
    setLines((prev) => prev.filter((_, i) => i !== index));
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    run(async () => {
      await apiSend(order ? `/api/admin/orders/${order.id}` : "/api/admin/orders", {
        method: order ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          supplierId: supplier?.id ?? null,
          reference,
          notes,
          orderedAt,
          lines: lines
            .filter((l) => l.product)
            .map((l) => ({ productId: l.product!.id, quantityOrdered: Number(l.quantityOrdered) })),
        }),
      });
      router.push("/admin/catalog/orders");
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-4">
      <Field label="Supplier" htmlFor="supplier">
        <Combobox
          id="supplier"
          label="Supplier"
          endpoint="/api/admin/suppliers"
          value={supplier}
          onChange={setSupplier}
          required
        />
      </Field>

      <Field label="Reference (optional)" htmlFor="reference">
        <input
          id="reference"
          value={reference ?? ""}
          onChange={(e) => setReference(e.target.value)}
          className="w-full rounded border border-admin-hairline px-2 py-1 text-sm"
        />
      </Field>

      <Field label="Ordered at" htmlFor="ordered-at">
        <input
          id="ordered-at"
          type="datetime-local"
          required
          value={orderedAt}
          onChange={(e) => setOrderedAt(e.target.value)}
          className="w-full rounded border border-admin-hairline px-2 py-1 text-sm"
        />
      </Field>

      <Field label="Notes (optional)" htmlFor="notes">
        <textarea
          id="notes"
          rows={2}
          value={notes ?? ""}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full rounded border border-admin-hairline px-2 py-1 text-sm"
        />
      </Field>

      <Field label="Lines">
        <div className="space-y-2">
          {lines.map((line, index) => (
            <div key={index} className="flex items-center gap-2">
              <div className="flex-1">
                <Combobox
                  label={`Product ${index + 1}`}
                  endpoint="/api/admin/products/search"
                  value={line.product}
                  onChange={(product) => updateLine(index, { product })}
                  allowCreate={false}
                />
              </div>
              <input
                type="number"
                min="1"
                step="1"
                aria-label={`Quantity ordered for line ${index + 1}`}
                value={line.quantityOrdered}
                onChange={(e) => updateLine(index, { quantityOrdered: e.target.value })}
                className="w-20 rounded border border-admin-hairline px-2 py-1 text-sm"
              />
              <button
                type="button"
                onClick={() => removeLine(index)}
                disabled={lines.length === 1}
                aria-label={`Remove line ${index + 1}`}
                className="text-admin-ink-muted hover:text-red-400 disabled:opacity-30"
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addLine}
          className="mt-2 rounded border border-admin-hairline px-2 py-1 text-xs hover:bg-admin-raised"
        >
          + Add line
        </button>
      </Field>

      {error && (
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded bg-admin-ink transition-colors duration-150 ease-out hover:bg-signal px-4 py-2 text-sm font-medium text-admin-bg disabled:opacity-60"
        >
          {saving ? "Saving…" : order ? "Save changes" : "Create order"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/admin/catalog/orders")}
          className="rounded border border-admin-hairline px-4 py-2 text-sm"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Use the `run-tests` skill. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/admin/OrderForm.tsx components/admin/OrderForm.test.tsx
git commit -m "feat: add supply order create/edit form"
```

---

## Task 19: Orders admin pages, receive UI, Catalog sub-nav

**Files:**
- Create: `components/admin/ReceiveOrderForm.tsx`
- Test: `components/admin/ReceiveOrderForm.test.tsx`
- Create: `app/admin/catalog/orders/page.tsx`
- Test: `app/admin/catalog/orders/orders-page.test.tsx`
- Create: `app/admin/catalog/orders/new/page.tsx`
- Create: `app/admin/catalog/orders/[id]/page.tsx`
- Test: `app/admin/catalog/orders/[id]/order-detail-page.test.tsx`
- Create: `app/admin/catalog/orders/[id]/edit/page.tsx`
- Create: `app/admin/catalog/layout.tsx`
- Modify: `app/admin/catalog/page.tsx`

**Interfaces:**
- Consumes: `OrderForm` (Task 18), `DeleteButton` (existing).

- [ ] **Step 1: Write the failing `ReceiveOrderForm` test**

```tsx
// components/admin/ReceiveOrderForm.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

import { ReceiveOrderForm } from "@/components/admin/ReceiveOrderForm";

const LINES = [
  { id: "l1", productTitle: "Vril — Torus", quantityOrdered: 5, quantityReceived: 2 },
];

beforeEach(() => vi.clearAllMocks());

describe("ReceiveOrderForm", () => {
  it("disables the input for a fully-received line", () => {
    render(
      <ReceiveOrderForm
        orderId="o1"
        lines={[{ id: "l2", productTitle: "X", quantityOrdered: 3, quantityReceived: 3 }]}
      />,
    );
    expect(screen.getByLabelText(/receive now for x/i)).toBeDisabled();
  });

  it("submits only lines with a receiveNow > 0 and refreshes on success", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    vi.stubGlobal("fetch", fetchMock);

    render(<ReceiveOrderForm orderId="o1" lines={LINES} />);
    await user.type(screen.getByLabelText(/receive now for vril — torus/i), "3");
    fireEvent.click(screen.getByRole("button", { name: /record receipt/i }));

    await waitFor(() => expect(refresh).toHaveBeenCalled());
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body).toEqual({ lines: [{ supplyOrderLineId: "l1", receiveNow: 3 }] });
  });

  it("shows a visible error when the receive fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: "Cannot receive more than ordered" }) }),
    );
    render(<ReceiveOrderForm orderId="o1" lines={LINES} />);
    fireEvent.click(screen.getByRole("button", { name: /record receipt/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/cannot receive more/i);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Use the `run-tests` skill. Expected: FAIL — component doesn't exist.

- [ ] **Step 3: Implement `ReceiveOrderForm.tsx`**

```tsx
// components/admin/ReceiveOrderForm.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { apiSend } from "@/lib/api-client";
import { useAsyncAction } from "@/lib/use-async-action";

interface ReceiveLine {
  id: string;
  productTitle: string;
  quantityOrdered: number;
  quantityReceived: number;
}

export function ReceiveOrderForm({ orderId, lines }: { orderId: string; lines: ReceiveLine[] }) {
  const router = useRouter();
  const { pending, error, run } = useAsyncAction();
  const [receiveNow, setReceiveNow] = useState<Record<string, string>>({});

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    run(async () => {
      await apiSend(`/api/admin/orders/${orderId}/receive`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          lines: lines
            .map((l) => ({ supplyOrderLineId: l.id, receiveNow: Number(receiveNow[l.id] ?? 0) }))
            .filter((l) => l.receiveNow > 0),
        }),
      });
      router.refresh();
      setReceiveNow({});
    });
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-xl space-y-3 rounded border border-admin-hairline p-4">
      <h2 className="text-sm font-semibold">Receive stock</h2>
      {lines.map((line) => {
        const remaining = line.quantityOrdered - line.quantityReceived;
        return (
          <div key={line.id} className="flex items-center justify-between gap-2 text-sm">
            <span>
              {line.productTitle}{" "}
              <span className="text-admin-ink-muted">
                ({line.quantityReceived}/{line.quantityOrdered} received)
              </span>
            </span>
            <input
              type="number"
              min="0"
              max={remaining}
              step="1"
              aria-label={`Receive now for ${line.productTitle}`}
              placeholder="0"
              disabled={remaining === 0}
              value={receiveNow[line.id] ?? ""}
              onChange={(e) => setReceiveNow((prev) => ({ ...prev, [line.id]: e.target.value }))}
              className="w-20 rounded border border-admin-hairline px-2 py-1 text-sm disabled:opacity-40"
            />
          </div>
        );
      })}
      {error && (
        <p role="alert" className="text-xs text-red-400">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-admin-ink transition-colors duration-150 ease-out hover:bg-signal px-4 py-2 text-sm font-medium text-admin-bg disabled:opacity-60"
      >
        {pending ? "Saving…" : "Record receipt"}
      </button>
    </form>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Use the `run-tests` skill. Expected: PASS.

- [ ] **Step 5: Write the failing orders list-page test**

```tsx
// app/admin/catalog/orders/orders-page.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));
vi.mock("@/lib/db", () => ({ db: { supplyOrder: { findMany: vi.fn() } } }));

import OrdersPage from "@/app/admin/catalog/orders/page";
import { db } from "@/lib/db";

beforeEach(() => vi.clearAllMocks());

describe("/admin/catalog/orders", () => {
  it("lists orders with supplier, status and item count", async () => {
    vi.mocked(db.supplyOrder.findMany).mockResolvedValue([
      {
        id: "o1",
        supplier: { name: "Kalahari Oyster Cult" },
        reference: "PO-1",
        status: "PARTIAL",
        orderedAt: new Date("2026-07-29"),
        receivedAt: null,
        lines: [{}, {}],
      },
    ] as never);
    render(await OrdersPage());
    expect(screen.getByText("Kalahari Oyster Cult")).toBeInTheDocument();
    expect(screen.getByText("PARTIAL")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("shows a placeholder with no orders", async () => {
    vi.mocked(db.supplyOrder.findMany).mockResolvedValue([] as never);
    render(await OrdersPage());
    expect(screen.getByText(/no supply orders yet/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 6: Run to verify it fails**

Use the `run-tests` skill. Expected: FAIL — page doesn't exist.

- [ ] **Step 7: Implement the orders list page**

```tsx
// app/admin/catalog/orders/page.tsx
import Link from "next/link";

import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const STATUS_STYLE: Record<string, string> = {
  PENDING: "bg-admin-raised text-admin-ink",
  PARTIAL: "bg-amber-500/15 text-amber-400",
  RECEIVED: "bg-green-500/15 text-green-400",
};

export default async function OrdersPage() {
  const orders = await db.supplyOrder.findMany({
    orderBy: { orderedAt: "desc" },
    include: { supplier: true, lines: true },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Supply orders</h1>
          <p className="text-sm text-admin-ink-muted">
            {orders.length} order{orders.length === 1 ? "" : "s"}
          </p>
        </div>
        <Link
          href="/admin/catalog/orders/new"
          className="rounded bg-admin-ink transition-colors duration-150 ease-out hover:bg-signal px-3 py-2 text-sm font-medium text-admin-bg"
        >
          New order
        </Link>
      </div>

      {orders.length === 0 ? (
        <p className="rounded border border-dashed border-admin-hairline p-8 text-center text-admin-ink-muted">
          No supply orders yet.
        </p>
      ) : (
        <div className="overflow-x-auto rounded border border-admin-hairline bg-admin-surface">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-admin-hairline bg-admin-bg text-admin-ink-muted">
              <tr>
                <th className="px-3 py-2 font-medium">Supplier</th>
                <th className="px-3 py-2 font-medium">Reference</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Items</th>
                <th className="px-3 py-2 font-medium">Ordered</th>
                <th className="px-3 py-2 font-medium">Received</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-admin-hairline">
              {orders.map((order) => (
                <tr key={order.id}>
                  <td className="px-3 py-2">
                    <Link href={`/admin/catalog/orders/${order.id}`} className="hover:underline">
                      {order.supplier.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-admin-ink-muted">{order.reference ?? "—"}</td>
                  <td className="px-3 py-2">
                    <span className={`rounded px-1.5 py-0.5 text-xs ${STATUS_STYLE[order.status]}`}>
                      {order.status}
                    </span>
                  </td>
                  <td className="px-3 py-2">{order.lines.length}</td>
                  <td className="px-3 py-2 text-admin-ink-muted">{order.orderedAt.toLocaleDateString()}</td>
                  <td className="px-3 py-2 text-admin-ink-muted">
                    {order.receivedAt ? order.receivedAt.toLocaleDateString() : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 8: Write the failing order-detail-page test**

```tsx
// app/admin/catalog/orders/[id]/order-detail-page.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));
vi.mock("next/navigation", () => ({ notFound: vi.fn(), useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/lib/db", () => ({ db: { supplyOrder: { findUnique: vi.fn() } } }));

import OrderDetailPage from "@/app/admin/catalog/orders/[id]/page";
import { db } from "@/lib/db";

const ORDER = {
  id: "o1",
  status: "PENDING",
  reference: "PO-1",
  supplier: { name: "Kalahari Oyster Cult" },
  lines: [{ id: "l1", quantityOrdered: 5, quantityReceived: 0, product: { title: "Torus" } }],
};

beforeEach(() => vi.clearAllMocks());

describe("/admin/catalog/orders/[id]", () => {
  it("shows Edit/Delete and the receive form for a PENDING order", async () => {
    vi.mocked(db.supplyOrder.findUnique).mockResolvedValue(ORDER as never);
    render(await OrderDetailPage({ params: Promise.resolve({ id: "o1" }) }));
    expect(screen.getByText("Edit")).toBeInTheDocument();
    expect(screen.getByText(/receive stock/i)).toBeInTheDocument();
  });

  it("hides Edit/Delete for a non-PENDING order, still shows receive for PARTIAL", async () => {
    vi.mocked(db.supplyOrder.findUnique).mockResolvedValue({ ...ORDER, status: "PARTIAL" } as never);
    render(await OrderDetailPage({ params: Promise.resolve({ id: "o1" }) }));
    expect(screen.queryByText("Edit")).toBeNull();
    expect(screen.getByText(/receive stock/i)).toBeInTheDocument();
  });

  it("hides the receive form entirely once RECEIVED", async () => {
    vi.mocked(db.supplyOrder.findUnique).mockResolvedValue({ ...ORDER, status: "RECEIVED" } as never);
    render(await OrderDetailPage({ params: Promise.resolve({ id: "o1" }) }));
    expect(screen.queryByText(/receive stock/i)).toBeNull();
  });
});
```

- [ ] **Step 9: Run to verify it fails**

Use the `run-tests` skill. Expected: FAIL — page doesn't exist.

- [ ] **Step 10: Implement the remaining order pages + Catalog sub-nav**

```tsx
// app/admin/catalog/orders/[id]/page.tsx
import { notFound } from "next/navigation";
import Link from "next/link";

import { db } from "@/lib/db";
import { DeleteButton } from "@/components/admin/DeleteButton";
import { ReceiveOrderForm } from "@/components/admin/ReceiveOrderForm";

export const dynamic = "force-dynamic";

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const order = await db.supplyOrder.findUnique({
    where: { id },
    include: { supplier: true, lines: { include: { product: true } } },
  });
  if (!order) notFound();

  const canReceive = order.status !== "RECEIVED";
  const canEdit = order.status === "PENDING";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Order from {order.supplier.name}</h1>
          <p className="text-sm text-admin-ink-muted">
            {order.reference ? `Ref ${order.reference} · ` : ""}Status: {order.status}
          </p>
        </div>
        {canEdit && (
          <div className="flex gap-3 text-sm">
            <Link href={`/admin/catalog/orders/${order.id}/edit`} className="hover:underline">
              Edit
            </Link>
            <DeleteButton endpoint={`/api/admin/orders/${order.id}`} />
          </div>
        )}
      </div>

      <table className="w-full text-left text-sm">
        <thead className="border-b border-admin-hairline text-admin-ink-muted">
          <tr>
            <th className="px-3 py-2 font-medium">Product</th>
            <th className="px-3 py-2 font-medium">Ordered</th>
            <th className="px-3 py-2 font-medium">Received</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-admin-hairline">
          {order.lines.map((line) => (
            <tr key={line.id}>
              <td className="px-3 py-2">{line.product.title}</td>
              <td className="px-3 py-2">{line.quantityOrdered}</td>
              <td className="px-3 py-2">{line.quantityReceived}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {canReceive && (
        <ReceiveOrderForm
          orderId={order.id}
          lines={order.lines.map((l) => ({
            id: l.id,
            productTitle: l.product.title,
            quantityOrdered: l.quantityOrdered,
            quantityReceived: l.quantityReceived,
          }))}
        />
      )}
    </div>
  );
}
```

```tsx
// app/admin/catalog/orders/new/page.tsx
import { OrderForm } from "@/components/admin/OrderForm";

export default function NewOrderPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">New supply order</h1>
      <OrderForm />
    </div>
  );
}
```

```tsx
// app/admin/catalog/orders/[id]/edit/page.tsx
import { notFound, redirect } from "next/navigation";

import { db } from "@/lib/db";
import { OrderForm } from "@/components/admin/OrderForm";

export const dynamic = "force-dynamic";

export default async function EditOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const order = await db.supplyOrder.findUnique({
    where: { id },
    include: { supplier: true, lines: { include: { product: true } } },
  });
  if (!order) notFound();
  if (order.status !== "PENDING") redirect(`/admin/catalog/orders/${order.id}`);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Edit supply order</h1>
      <OrderForm
        order={{
          id: order.id,
          supplier: { id: order.supplier.id, name: order.supplier.name },
          reference: order.reference,
          notes: order.notes,
          orderedAt: order.orderedAt.toISOString().slice(0, 16),
          lines: order.lines.map((l) => ({
            product: { id: l.product.id, name: `${l.product.primaryArtistName} — ${l.product.title}` },
            quantityOrdered: l.quantityOrdered,
          })),
        }}
      />
    </div>
  );
}
```

Add the Catalog sub-nav (new file), matching the existing `Settings`/`Content` layout pattern:

```tsx
// app/admin/catalog/layout.tsx
import { AdminSubNav } from "@/components/layout/AdminSubNav";

const ITEMS = [
  { href: "/admin/catalog", label: "Catalog" },
  { href: "/admin/catalog/reference", label: "Reference data" },
  { href: "/admin/catalog/orders", label: "Orders" },
];

export default function CatalogLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <AdminSubNav items={ITEMS} />
      {children}
    </div>
  );
}
```

`AdminSubNav` highlights by exact-or-prefix match (`pathname === item.href || pathname.startsWith(item.href + "/")`), so `/admin/catalog` itself won't fight with `/admin/catalog/reference` or `/admin/catalog/orders` for the active state.

In `app/admin/catalog/page.tsx`, remove the now-redundant inline link (the sub-nav replaces it — every other section's list page relies solely on its sub-nav, none duplicate a link inline):
```tsx
          <p className="text-sm text-admin-ink-muted">
            {result.total} product{result.total === 1 ? "" : "s"} ·{" "}
            <Link href="/admin/catalog/reference" className="underline">
              Reference data
            </Link>
          </p>
```
becomes:
```tsx
          <p className="text-sm text-admin-ink-muted">
            {result.total} product{result.total === 1 ? "" : "s"}
          </p>
```
(The `Link` import in that file may now be unused if nothing else in it references `next/link` — check before removing the import; `DeleteProductButton`/`SellOneButton`/pagination all use plain `<Link href=...>` elsewhere in the same file for pagination and the Edit link, so the import stays.)

- [ ] **Step 11: Run to verify everything passes**

Use the `run-tests` skill on the full new/changed set from this task. Expected: PASS.

- [ ] **Step 12: Commit**

```bash
git add components/admin/ReceiveOrderForm.tsx components/admin/ReceiveOrderForm.test.tsx app/admin/catalog/orders app/admin/catalog/layout.tsx app/admin/catalog/page.tsx
git commit -m "feat: add supply order admin pages, receive UI, and Catalog sub-nav"
```

---

## Task 20: Full verification pass

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Use the `run-tests` skill for the entire suite (not a filtered subset). Expected: all green, including the pre-existing 681 tests plus everything added in Tasks 1–19.

- [ ] **Step 2: Typecheck and lint**

```bash
npm run typecheck
npm run lint
```

Expected: zero errors on both.

- [ ] **Step 3: Manual smoke test in the browser**

Start the dev server (`npm run dev`), sign in to `/admin`, and walk the golden path:
1. Create a Supplier at `/admin/settings/suppliers/new`.
2. Create a Product (quantity should show nothing on the create form; after saving, the edit page shows quantity `0`).
3. Create a Supply Order at `/admin/catalog/orders/new` for that product, quantity 5.
4. On the order detail page, receive 3 of 5 — confirm status becomes `PARTIAL` and the product's edit-page quantity is now 3, with a transaction history row showing `+3` and a note referencing the supply order.
5. Receive the remaining 2 — confirm status becomes `RECEIVED`.
6. Use "Sell one" on the product — confirm quantity drops to 4 and a new `OUT` row appears.
7. Use "Adjust stock" with delta `-10` — confirm it floors at 0, not negative, and the recorded transaction is `-4` (whatever was actually there), not `-10`.
8. Try deleting the Supplier — confirm it's blocked (409, visible error) since it has a supply order.

If anything in this walkthrough doesn't match, fix it before proceeding to close-out — this is real behavior verification the automated suite can't fully replace (per CLAUDE.md: "For UI or frontend changes... test the golden path... before reporting the task as complete").

- [ ] **Step 4: Fix anything the smoke test surfaces, then re-run Steps 1–2**

(No separate commit for this step unless a fix is needed — if a fix is needed, commit it with a `fix:` message describing exactly what broke.)

---

## Task 21: Close-out (per `docs/instructions/branching.md`)

**Files:**
- Create: `docs/features/stock-management.md`
- Create: `docs/sessions/<today>.md` (using `docs/session-log-template.md`)
- Modify: `tasks/todo.md`
- Modify: `tasks/lessons.md` (only if a new pitfall was actually discovered during implementation — don't force an entry)

- [ ] **Step 1: Run `/code-review`**

This branch touches auth-adjacent admin routes, a new data model, and more than 5 files — mandatory per `CLAUDE.md`'s "When to run /code-review". Ask the user to run it (this repo has `/code-review` set to disable-model-invocation — it cannot be self-invoked). Fix all Medium+ findings before merging; lower-severity findings are discretionary.

- [ ] **Step 2: Write `docs/features/stock-management.md`**

Summarize what shipped: the ledger invariant, the floor-at-zero-and-record-the-clamped-amount rule, re-receiving support on PARTIAL orders, and the two approved breaking changes (sell-one's 400-at-zero, product create/update no longer accepting `quantity`). Link back to `docs/superpowers/specs/2026-07-29-stock-management-design.md`.

- [ ] **Step 3: Fill in the session log**

Use `docs/session-log-template.md` at `docs/sessions/<today's date>.md`.

- [ ] **Step 4: Update `tasks/todo.md`**

Move stock management from wherever it was tracked (if at all) into the "done" record, following the existing convention (see how `admin-blog-posts.md` etc. are referenced in the Active section's history).

- [ ] **Step 5: Merge and push**

```bash
git checkout master
git merge feature/stock-management
git branch -d feature/stock-management
git push
```

(Fast-forward merge per `branching.md`; only proceed once Task 20's verification and Step 1's code review are both clean.)

- [ ] **Step 6: Commit the close-out docs**

```bash
git add docs/features/stock-management.md docs/sessions docs/superpowers/plans docs/superpowers/specs tasks/todo.md tasks/lessons.md
git commit -m "docs: close out stock management feature"
git push
```
