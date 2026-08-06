# Order & Transaction System Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the manual supply-order admin UI with a product-driven "Order" button (quick-add), a grouped orders overview with inline receive/edit, and a new monthly transactions ledger page.

**Architecture:** Additive Prisma migration (`Product.supplierId`, `Label.supplierId`, `SupplyOrderStatus.SENT`) plus new `lib/*.ts` query/mutation modules reused directly by server-component pages (no HTTP round-trip for reads, matching this repo's existing `lib/catalog.ts` convention) and by thin API routes for client mutations. Client interactivity stays in small, focused `"use client"` components using the existing `apiSend`/`useAsyncAction` pair — no new state library.

**Tech Stack:** Next.js 16 App Router, TypeScript, Prisma + PostgreSQL, Vitest + React Testing Library.

## Global Constraints

- Follow `docs/instructions/branching.md`: branch `feature/order-transaction-redesign` (already created), commit after every task, fast-forward merge, `/code-review` mandatory before merge (schema change + new API contracts).
- Follow `docs/instructions/testing.md` / this repo's Test Contract: behavior-only tests, no CSS/class assertions, `lib/*.ts` gets full TDD coverage, API routes get contract-level tests, components get role/text RTL queries.
- Never run bare `prisma migrate dev` in this repo without `--create-only` first — it hangs on pre-existing `search_vector`/trigram drift (`tasks/lessons.md`, 2026-07-08/07-17/07-29b/c). Restart the dev server after any applied migration.
- Use the run-tests skill (`scripts/run-tests.sh` / `npm test`) for full-suite verification; targeted `npx vitest run <path>` during TDD cycles is expected and fine.
- Spec of record: `docs/superpowers/specs/2026-08-06-order-transaction-redesign-design.md`. Do not deviate from its approved decisions without flagging it back to the user first.
- Deliberate interface changes (removed routes/tests) are pre-approved by that spec — implement them as removals, not as red leftover tests.

---

## Task 1: Schema migration — SENT status, Product.supplierId, Label.supplierId

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_add_order_redesign/migration.sql` (generated, hand-verified)

**Interfaces:**
- Produces: `Product.supplierId: string | null`, `Label.supplierId: string | null`, `SupplyOrderStatus` gains `"SENT"` (between `PENDING` and `PARTIAL` in the enum). Every later task that touches `Product`, `Label`, or `SupplyOrderStatus` depends on this.

- [ ] **Step 1: Edit the schema**

In `prisma/schema.prisma`, update the enum and two models:

```prisma
enum SupplyOrderStatus {
  PENDING
  SENT
  PARTIAL
  RECEIVED
}
```

```prisma
model Supplier {
  id           String        @id @default(cuid())
  name         String        @unique
  contact      String?
  supplyOrders SupplyOrder[]
  products     Product[]
  labels       Label[]
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt
}
```

```prisma
model Label {
  id         String    @id @default(cuid())
  name       String    @unique
  products   Product[]
  supplierId String?
  supplier   Supplier? @relation(fields: [supplierId], references: [id])
  createdAt  DateTime  @default(now())
  updatedAt  DateTime  @updatedAt

  @@index([supplierId])
}
```

In `Product`, add after `labelId`/`label`:

```prisma
  supplierId        String?
  supplier          Supplier?       @relation(fields: [supplierId], references: [id])
```

and add `@@index([supplierId])` alongside the model's other `@@index` lines.

- [ ] **Step 2: Generate the migration without applying it**

Run: `npx prisma migrate dev --create-only --name add_order_redesign`

- [ ] **Step 3: Verify the generated SQL touches only the intended tables**

Open the generated `migration.sql`. It must contain only: the `SupplyOrderStatus` enum change (Postgres requires `ALTER TYPE ... ADD VALUE`), `ALTER TABLE "Label" ADD COLUMN "supplierId" ...` + its FK + index, and the same three for `"Product"`. If it contains any `DROP INDEX`/`DROP` touching `search_vector`, `product_search_idx`, `product_title_trgm_idx`, or `artist_name_trgm_idx`, delete those lines — they are pre-existing manual-migration drift, not part of this change (see `tasks/lessons.md`).

- [ ] **Step 4: Apply the migration**

Run: `npx prisma migrate dev --name add_order_redesign`
Expected: applies cleanly, Prisma Client regenerates.

- [ ] **Step 5: Restart the dev server if one is running**

Stale Prisma Client from before the migration will otherwise 500 on any query touching the new columns.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat: add SupplyOrderStatus.SENT, Product.supplierId, Label.supplierId"
```

---

## Task 2: Label gains supplierId — bespoke API routes + widened Supplier delete guard

**Files:**
- Create: `lib/label-input.ts`
- Create: `lib/label-input.test.ts`
- Modify: `app/api/admin/labels/route.ts` (replace the `lib/reference-crud.ts` factory usage with bespoke handlers)
- Create: `app/api/admin/labels/route.test.ts`
- Modify: `app/api/admin/labels/[id]/route.ts` (same)
- Create: `app/api/admin/labels/[id]/route.test.ts`
- Modify: `app/api/admin/suppliers/[id]/route.ts` (widen DELETE guard)
- Modify: `app/api/admin/suppliers/[id]/route.test.ts` (if it exists — check first; extend its DELETE guard test)

**Interfaces:**
- Consumes: `Task 1`'s `Label.supplierId`.
- Produces: `GET /api/admin/labels?q=` now returns `{ id, name, productCount, supplierId, supplierName }[]` (was `{ id, name, productCount }[]`) — Task 4 (`ReferenceSection`) and Task 5 (`ProductForm`'s create-time prefill) both depend on the `supplierId`/`supplierName` fields being present on every item. `POST`/`PATCH` accept an optional `supplierId` in the body and return the same shape.

Label moves off the generic `lib/reference-crud.ts` factory (which only knows `{ name }`) for the same reason `Supplier` already has its own route file instead of using it — an extra field beyond `name`. Genre/ProductType/Artist keep using the factory unchanged.

- [ ] **Step 1: Write the failing test for `parseLabelInput`**

```ts
// lib/label-input.test.ts
// @vitest-environment node
import { describe, it, expect } from "vitest";

import { parseLabelInput } from "@/lib/label-input";

describe("parseLabelInput", () => {
  it("accepts a name with no supplier", () => {
    expect(parseLabelInput({ name: "Warp" })).toEqual({
      ok: true,
      data: { name: "Warp", supplierId: null },
    });
  });

  it("accepts a name with a supplierId", () => {
    expect(parseLabelInput({ name: "Warp", supplierId: "s1" })).toEqual({
      ok: true,
      data: { name: "Warp", supplierId: "s1" },
    });
  });

  it("rejects a blank name", () => {
    expect(parseLabelInput({ name: "  " })).toEqual({
      ok: false,
      error: "Name is required",
    });
  });

  it("treats a blank supplierId as null", () => {
    expect(parseLabelInput({ name: "Warp", supplierId: "  " })).toEqual({
      ok: true,
      data: { name: "Warp", supplierId: null },
    });
  });
});
```

- [ ] **Step 2: Run it, confirm it fails**

Run: `npx vitest run lib/label-input.test.ts`
Expected: FAIL — `lib/label-input.ts` does not exist.

- [ ] **Step 3: Implement `lib/label-input.ts`**

```ts
export interface LabelInput {
  name: string;
  supplierId: string | null;
}

export type ParseResult = { ok: true; data: LabelInput } | { ok: false; error: string };

export function parseLabelInput(body: unknown): ParseResult {
  const b = (body ?? {}) as Record<string, unknown>;
  const name = typeof b.name === "string" ? b.name.trim() : "";
  if (!name) return { ok: false, error: "Name is required" };
  const supplierId = typeof b.supplierId === "string" ? b.supplierId.trim() : "";
  return { ok: true, data: { name, supplierId: supplierId || null } };
}
```

- [ ] **Step 4: Run it, confirm it passes**

Run: `npx vitest run lib/label-input.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Write the failing route tests**

```ts
// app/api/admin/labels/route.test.ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

vi.mock("@/lib/api-auth", () => ({ requireAdmin: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/db", () => ({ db: { label: { findMany: vi.fn(), create: vi.fn() } } }));

import { db } from "@/lib/db";
import { GET, POST } from "@/app/api/admin/labels/route";
import { requireAdmin } from "@/lib/api-auth";

const label = db.label as unknown as { findMany: Mock; create: Mock };
const mockRequireAdmin = vi.mocked(requireAdmin);
const getReq = (q = "") => new Request(`http://t/x?q=${q}`);
const postReq = (body: unknown) =>
  new Request("http://t/x", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAdmin.mockResolvedValue(null);
});

describe("GET /api/admin/labels", () => {
  it("shapes each row with supplierId/supplierName", async () => {
    label.findMany.mockResolvedValue([
      { id: "l1", name: "Warp", _count: { products: 3 }, supplier: { id: "s1", name: "Beta" } },
      { id: "l2", name: "Ghostly", _count: { products: 0 }, supplier: null },
    ]);
    const res = await GET(getReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([
      { id: "l1", name: "Warp", productCount: 3, supplierId: "s1", supplierName: "Beta" },
      { id: "l2", name: "Ghostly", productCount: 0, supplierId: null, supplierName: null },
    ]);
  });
});

describe("POST /api/admin/labels", () => {
  it("creates a label with a supplier (201)", async () => {
    label.create.mockResolvedValue({
      id: "l1",
      name: "Warp",
      supplier: { id: "s1", name: "Beta" },
    });
    const res = await POST(postReq({ name: "Warp", supplierId: "s1" }));
    expect(res.status).toBe(201);
    expect(label.create).toHaveBeenCalledWith({
      data: { name: "Warp", supplierId: "s1" },
      include: { supplier: true },
    });
    expect(await res.json()).toEqual({
      id: "l1",
      name: "Warp",
      supplierId: "s1",
      supplierName: "Beta",
    });
  });

  it("400s a blank name without writing", async () => {
    const res = await POST(postReq({ name: "" }));
    expect(res.status).toBe(400);
    expect(label.create).not.toHaveBeenCalled();
  });

  it("409s a duplicate name", async () => {
    label.create.mockRejectedValue({ code: "P2002" });
    const res = await POST(postReq({ name: "Warp" }));
    expect(res.status).toBe(409);
  });
});
```

```ts
// app/api/admin/labels/[id]/route.test.ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

vi.mock("@/lib/api-auth", () => ({ requireAdmin: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/db", () => ({
  db: { label: { update: vi.fn(), findUnique: vi.fn(), delete: vi.fn() } },
}));

import { db } from "@/lib/db";
import { PATCH, DELETE } from "@/app/api/admin/labels/[id]/route";
import { requireAdmin } from "@/lib/api-auth";

const label = db.label as unknown as { update: Mock; findUnique: Mock; delete: Mock };
const mockRequireAdmin = vi.mocked(requireAdmin);
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const patchReq = (body: unknown) =>
  new Request("http://t/x", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
const delReq = () => new Request("http://t/x", { method: "DELETE" });

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAdmin.mockResolvedValue(null);
});

describe("PATCH /api/admin/labels/[id]", () => {
  it("updates name and supplierId, returns the shaped item", async () => {
    label.update.mockResolvedValue({
      id: "l1",
      name: "Warp Records",
      supplier: { id: "s1", name: "Beta" },
    });
    const res = await PATCH(patchReq({ name: "Warp Records", supplierId: "s1" }), ctx("l1"));
    expect(res.status).toBe(200);
    expect(label.update).toHaveBeenCalledWith({
      where: { id: "l1" },
      data: { name: "Warp Records", supplierId: "s1" },
      include: { supplier: true },
    });
    expect(await res.json()).toEqual({
      id: "l1",
      name: "Warp Records",
      supplierId: "s1",
      supplierName: "Beta",
    });
  });

  it("404s an unknown label", async () => {
    label.update.mockRejectedValue({ code: "P2025" });
    const res = await PATCH(patchReq({ name: "X" }), ctx("missing"));
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/admin/labels/[id]", () => {
  it("409s a label still used by products", async () => {
    label.findUnique.mockResolvedValue({ id: "l1", _count: { products: 2 } });
    const res = await DELETE(delReq(), ctx("l1"));
    expect(res.status).toBe(409);
    expect(label.delete).not.toHaveBeenCalled();
  });

  it("deletes an unused label", async () => {
    label.findUnique.mockResolvedValue({ id: "l1", _count: { products: 0 } });
    label.delete.mockResolvedValue({ id: "l1" });
    const res = await DELETE(delReq(), ctx("l1"));
    expect(res.status).toBe(200);
  });
});
```

- [ ] **Step 6: Run them, confirm they fail**

Run: `npx vitest run app/api/admin/labels`
Expected: FAIL — routes still use the generic factory and return the old shape.

- [ ] **Step 7: Implement the bespoke Label routes**

```ts
// app/api/admin/labels/route.ts
import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { parseLabelInput } from "@/lib/label-input";

const SEARCH_LIMIT = 20;

function isUniqueViolation(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === "P2002";
}

// Bespoke, not lib/reference-crud.ts's generic factory — Label carries an
// optional supplierId that Genre/ProductType don't, same reason Supplier
// already has its own route file.
export async function GET(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  const rows = await db.label.findMany({
    where: q ? { name: { contains: q, mode: "insensitive" } } : undefined,
    orderBy: { name: "asc" },
    take: SEARCH_LIMIT,
    include: { _count: { select: { products: true } }, supplier: true },
  });
  const items = rows.map((r) => ({
    id: r.id,
    name: r.name,
    productCount: r._count.products,
    supplierId: r.supplier?.id ?? null,
    supplierName: r.supplier?.name ?? null,
  }));
  return NextResponse.json(items);
}

export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const parsed = parseLabelInput(await req.json().catch(() => null));
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  try {
    const created = await db.label.create({
      data: { name: parsed.data.name, supplierId: parsed.data.supplierId },
      include: { supplier: true },
    });
    return NextResponse.json(
      {
        id: created.id,
        name: created.name,
        supplierId: created.supplier?.id ?? null,
        supplierName: created.supplier?.name ?? null,
      },
      { status: 201 },
    );
  } catch (error) {
    if (isUniqueViolation(error)) {
      return NextResponse.json(
        { error: `"${parsed.data.name}" already exists` },
        { status: 409 },
      );
    }
    throw error;
  }
}
```

```ts
// app/api/admin/labels/[id]/route.ts
import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { parseLabelInput } from "@/lib/label-input";

type RouteContext = { params: Promise<{ id: string }> };

function isUniqueViolation(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === "P2002";
}

export async function PATCH(req: Request, ctx: RouteContext) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await ctx.params;
  const parsed = parseLabelInput(await req.json().catch(() => null));
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  try {
    const updated = await db.label.update({
      where: { id },
      data: { name: parsed.data.name, supplierId: parsed.data.supplierId },
      include: { supplier: true },
    });
    return NextResponse.json({
      id: updated.id,
      name: updated.name,
      supplierId: updated.supplier?.id ?? null,
      supplierName: updated.supplier?.name ?? null,
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return NextResponse.json(
        { error: `"${parsed.data.name}" already exists` },
        { status: 409 },
      );
    }
    if ((error as { code?: string } | null)?.code === "P2025") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    throw error;
  }
}

export async function DELETE(_req: Request, ctx: RouteContext) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await ctx.params;
  const label = await db.label.findUnique({
    where: { id },
    include: { _count: { select: { products: true } } },
  });
  if (!label) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (label._count.products > 0) {
    return NextResponse.json(
      { error: `In use by ${label._count.products} products`, count: label._count.products },
      { status: 409 },
    );
  }
  await db.label.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 8: Run the label route tests, confirm they pass**

Run: `npx vitest run app/api/admin/labels`
Expected: PASS.

- [ ] **Step 9: Widen the Supplier delete guard — write the failing test first**

Read `app/api/admin/suppliers/[id]/route.test.ts` first to match its existing style, then add:

```ts
it("409s a supplier still linked to products or labels, not just supply orders", async () => {
  supplier.findUnique.mockResolvedValue({
    id: "s1",
    _count: { supplyOrders: 0, products: 2, labels: 1 },
  });
  const res = await DELETE(delReq(), ctx("s1"));
  expect(res.status).toBe(409);
  expect(supplier.delete).not.toHaveBeenCalled();
});
```

(Adjust the `supplier` mock declaration at the top of that file to include `findUnique: vi.fn(), delete: vi.fn()` if not already present, matching the existing test's mock shape.)

- [ ] **Step 10: Run it, confirm it fails**

Run: `npx vitest run app/api/admin/suppliers/\[id\]/route.test.ts`
Expected: FAIL — current guard only checks `supplyOrders`.

- [ ] **Step 11: Widen the guard in `app/api/admin/suppliers/[id]/route.ts`**

```ts
// Guarded like Label/Genre/ProductType/Artist: a supplier still referenced
// by any supply order, product, or label (any status/relation) can't be
// deleted.
export async function DELETE(_req: Request, ctx: RouteContext) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await ctx.params;
  const supplier = await db.supplier.findUnique({
    where: { id },
    include: { _count: { select: { supplyOrders: true, products: true, labels: true } } },
  });
  if (!supplier) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const inUseCount =
    supplier._count.supplyOrders + supplier._count.products + supplier._count.labels;
  if (inUseCount > 0) {
    return NextResponse.json(
      { error: `In use by ${inUseCount} record(s)`, count: inUseCount },
      { status: 409 },
    );
  }
  await db.supplier.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 12: Run the full suppliers test file, confirm it passes**

Run: `npx vitest run app/api/admin/suppliers/\[id\]/route.test.ts`
Expected: PASS, including the pre-existing supply-order-only case (it should still 409 since `inUseCount` still counts it).

- [ ] **Step 13: Commit**

```bash
git add lib/label-input.ts lib/label-input.test.ts \
  app/api/admin/labels app/api/admin/suppliers/\[id\]/route.ts \
  app/api/admin/suppliers/\[id\]/route.test.ts
git commit -m "feat: give Label an optional supplierId, widen Supplier delete guard"
```

---

## Task 3: Product gains supplierId — lib/product-input.ts + routes

**Files:**
- Modify: `lib/product-input.ts`
- Modify: `lib/product-input.test.ts`
- Modify: `app/api/admin/products/route.ts` (error message only)
- Modify: `app/api/admin/products/[id]/route.ts` (error message only)

**Interfaces:**
- Consumes: `Task 1`'s `Product.supplierId`.
- Produces: `ProductInput` gains `supplierId: string | null`; `toProductData(data, {primaryArtistName, mode})` connects/disconnects `supplier` accordingly. Task 5 (`ProductForm`) depends on this field existing in the parsed/submitted shape.

- [ ] **Step 1: Write the failing tests**

Read `lib/product-input.test.ts` in full first (it's short) so new cases match its existing `VALID` fixture and style, then add:

```ts
it("accepts an optional supplierId and nullifies it when absent", () => {
  const withSupplier = parseProductInput({ ...VALID, supplierId: "s1" });
  expect(withSupplier.ok).toBe(true);
  if (withSupplier.ok) expect(withSupplier.data.supplierId).toBe("s1");

  const without = parseProductInput(VALID);
  expect(without.ok).toBe(true);
  if (without.ok) expect(without.data.supplierId).toBeNull();
});

describe("toProductData", () => {
  it("connects supplier when supplierId is set", () => {
    const parsed = parseProductInput({ ...VALID, supplierId: "s1" });
    if (!parsed.ok) throw new Error("expected ok");
    const data = toProductData(parsed.data, { primaryArtistName: "Vril", mode: "create" });
    expect(data.supplier).toEqual({ connect: { id: "s1" } });
  });

  it("omits supplier on create when supplierId is null", () => {
    const parsed = parseProductInput(VALID);
    if (!parsed.ok) throw new Error("expected ok");
    const data = toProductData(parsed.data, { primaryArtistName: "Vril", mode: "create" });
    expect(data).not.toHaveProperty("supplier");
  });

  it("disconnects supplier on update when supplierId is null", () => {
    const parsed = parseProductInput(VALID);
    if (!parsed.ok) throw new Error("expected ok");
    const data = toProductData(parsed.data, { primaryArtistName: "Vril", mode: "update" });
    expect(data.supplier).toEqual({ disconnect: true });
  });
});
```

(If `toProductData` isn't already imported in the test file, add it to the existing `import { parseProductInput, toProductData } from "@/lib/product-input";` line — it likely already is, since the file tests both.)

- [ ] **Step 2: Run it, confirm it fails**

Run: `npx vitest run lib/product-input.test.ts`
Expected: FAIL — `supplierId` isn't parsed, `toProductData` doesn't touch `supplier`.

- [ ] **Step 3: Implement**

In `lib/product-input.ts`, add to `ProductInput`:

```ts
export interface ProductInput {
  artistIds: string[];
  title: string;
  catalogNumber: string | null;
  labelId: string;
  genreId: string;
  productTypeId: string;
  supplierId: string | null;
  condition: "NEW" | "SECONDHAND";
  price: string;
  description: string | null;
  coverImage: string | null;
}
```

In `parseProductInput`'s return, add `supplierId: str(b.supplierId) || null,` alongside the other fields.

In `toProductData`:

```ts
export function toProductData(
  data: ProductInput,
  { primaryArtistName, mode }: { primaryArtistName: string; mode: "create" | "update" },
) {
  return {
    title: data.title,
    catalogNumber: data.catalogNumber,
    condition: data.condition,
    price: data.price,
    description: data.description,
    coverImage: data.coverImage,
    label: { connect: { id: data.labelId } },
    genre: { connect: { id: data.genreId } },
    productType: { connect: { id: data.productTypeId } },
    ...(data.supplierId
      ? { supplier: { connect: { id: data.supplierId } } }
      : mode === "update"
        ? { supplier: { disconnect: true } }
        : {}),
    primaryArtistName,
    productArtists: {
      ...(mode === "update" ? { deleteMany: {} } : {}),
      create: data.artistIds.map((artistId, position) => ({ artistId, position })),
    },
  };
}
```

- [ ] **Step 4: Run it, confirm it passes**

Run: `npx vitest run lib/product-input.test.ts`
Expected: PASS.

- [ ] **Step 5: Update the two P2025 error messages**

In `app/api/admin/products/route.ts` and `app/api/admin/products/[id]/route.ts`, change:
`"Selected label, genre or product type no longer exists"` → `"Selected label, genre, product type, or supplier no longer exists"`.
No test changes needed if the existing tests for this branch assert on status code only; if any assert the exact message text, update it there too (grep first: `grep -rn "no longer exists" app/api/admin/products`).

- [ ] **Step 6: Run the products route tests, confirm still green**

Run: `npx vitest run app/api/admin/products`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add lib/product-input.ts lib/product-input.test.ts app/api/admin/products
git commit -m "feat: add optional supplierId to Product create/update"
```

---

## Task 4: ReferenceSection — opt-in supplier picker for Labels

**Files:**
- Modify: `app/admin/catalog/reference/ReferenceSection.tsx`
- Modify: `app/admin/catalog/reference/ReferenceSection.test.tsx`
- Modify: `app/admin/catalog/reference/page.tsx`
- Modify: `app/admin/catalog/reference/page.test.tsx` (only if it asserts the Labels section's props/query — check first)

**Interfaces:**
- Consumes: `Task 2`'s labels endpoint shape (`supplierId`/`supplierName` per item).
- Produces: `ReferenceSection` gains an optional `supplierEndpoint?: string` prop. When absent (Genres/ProductTypes/Artists), behavior is byte-identical to today. When present (Labels only), the add-form and each edit row show a `Supplier` `Combobox`.

- [ ] **Step 1: Write the failing test**

Read `ReferenceSection.test.tsx` in full first to match its existing render/mock setup, then add (adjust the `Combobox` mock to whatever pattern that test file already uses for other child components, or add a lightweight one if none exists — `Combobox` calls `fetch` internally, so mock `global.fetch` for the supplier search the same way the file already mocks `fetch` for the main search, if it does):

```tsx
describe("supplier field (Labels only)", () => {
  it("does not render a supplier field when supplierEndpoint is absent", () => {
    render(
      <ReferenceSection
        title="Genres"
        endpoint="/api/admin/genres"
        initialItems={[]}
        initialTotal={0}
      />,
    );
    expect(screen.queryByRole("combobox", { name: /supplier/i })).toBeNull();
  });

  it("sends supplierId when adding an item with supplierEndpoint set", async () => {
    const user = userEvent.setup();
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "l1", name: "Warp", supplierId: "s1", supplierName: "Beta" }),
    } as Response);

    render(
      <ReferenceSection
        title="Labels"
        endpoint="/api/admin/labels"
        initialItems={[]}
        initialTotal={0}
        supplierEndpoint="/api/admin/suppliers"
      />,
    );
    await user.type(screen.getByLabelText(/new labels name/i), "Warp");
    await user.click(screen.getByRole("button", { name: /^add$/i }));

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/admin/labels",
      expect.objectContaining({
        body: JSON.stringify({ name: "Warp", supplierId: null }),
      }),
    );
  });
});
```

(This second test intentionally exercises the "no supplier picked" path, which is the cheapest to assert against `fetch` call args without also driving the `Combobox`'s own async typeahead. `Combobox` itself already has its own test coverage — don't retest its internals here.)

- [ ] **Step 2: Run it, confirm it fails**

Run: `npx vitest run app/admin/catalog/reference/ReferenceSection.test.tsx`
Expected: FAIL — no `supplierEndpoint` prop yet, `Add` always POSTs `{ name }` only.

- [ ] **Step 3: Implement**

In `ReferenceSection.tsx`, add the import and prop:

```tsx
import { Combobox, type ComboboxOption } from "@/components/ui/Combobox";

export interface ReferenceItem {
  id: string;
  name: string;
  productCount: number;
  supplierId?: string | null;
  supplierName?: string | null;
}
```

```tsx
export function ReferenceSection({
  title,
  endpoint,
  initialItems,
  initialTotal,
  supplierEndpoint,
}: {
  title: string;
  endpoint: string;
  initialItems: ReferenceItem[];
  initialTotal: number;
  supplierEndpoint?: string;
}) {
```

Add state alongside the existing `newName`/`editName` state:

```tsx
  const [newSupplier, setNewSupplier] = useState<ComboboxOption | null>(null);
  const [editSupplier, setEditSupplier] = useState<ComboboxOption | null>(null);
```

In `handleAdd`, change the POST body and success handling:

```tsx
  function handleAdd(event: React.FormEvent) {
    event.preventDefault();
    const name = newName.trim();
    if (!name) return;
    run(async () => {
      const created = await apiSend<{
        id: string;
        name: string;
        supplierId?: string | null;
        supplierName?: string | null;
      }>(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          supplierEndpoint ? { name, supplierId: newSupplier?.id ?? null } : { name },
        ),
      });
      setTotalCount((n) => n + 1);
      const trimmedQuery = query.trim();
      const matchesQuery =
        trimmedQuery === "" ||
        created.name.toLowerCase().includes(trimmedQuery.toLowerCase());
      searchSeq.current++;
      if (matchesQuery) {
        setItems((prev) =>
          [
            ...prev,
            {
              ...created,
              productCount: 0,
              supplierId: created.supplierId ?? null,
              supplierName: created.supplierName ?? null,
            },
          ].sort((a, b) => a.name.localeCompare(b.name)),
        );
      }
      setNewName("");
      setNewSupplier(null);
    });
  }
```

In `handleSaveEdit`, mirror the same body change and merge `supplierId`/`supplierName` into the updated item:

```tsx
  function handleSaveEdit(id: string) {
    const name = editName.trim();
    if (!name) return;
    run(async () => {
      await apiSend(`${endpoint}/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          supplierEndpoint ? { name, supplierId: editSupplier?.id ?? null } : { name },
        ),
      });
      searchSeq.current++;
      setItems((prev) =>
        prev
          .map((item) =>
            item.id === id
              ? {
                  ...item,
                  name,
                  supplierId: editSupplier?.id ?? null,
                  supplierName: editSupplier?.name ?? null,
                }
              : item,
          )
          .sort((a, b) => a.name.localeCompare(b.name)),
      );
      setEditingId(null);
    });
  }
```

Add a `startEdit` helper used by the "Edit" button's `onClick` (replacing its current inline `setEditingId`/`setEditName` pair):

```tsx
  function startEdit(item: ReferenceItem) {
    setEditingId(item.id);
    setEditName(item.name);
    setEditSupplier(
      item.supplierId ? { id: item.supplierId, name: item.supplierName ?? "" } : null,
    );
  }
```

Update the "Edit" button's `onClick={() => { setEditingId(item.id); setEditName(item.name); }}` to `onClick={() => startEdit(item)}`.

Add the supplier field to the add form, right after the existing `<input>`/`<button>` pair inside `<form onSubmit={handleAdd} ...>`:

```tsx
        {supplierEndpoint && (
          <Combobox
            label="Supplier"
            endpoint={supplierEndpoint}
            value={newSupplier}
            onChange={setNewSupplier}
            allowCreate={false}
          />
        )}
```

Add it to the edit row too, inside the `editingId === item.id` branch, after the edit `<input>`:

```tsx
                    {supplierEndpoint && (
                      <Combobox
                        label="Supplier"
                        endpoint={supplierEndpoint}
                        value={editSupplier}
                        onChange={setEditSupplier}
                        allowCreate={false}
                      />
                    )}
```

And show the current supplier in the read (non-editing) row when `supplierEndpoint` is set, next to the item name:

```tsx
                    <span className="flex-1">
                      {item.name}
                      {supplierEndpoint && (
                        <span className="ml-2 text-xs text-admin-ink-muted">
                          {item.supplierName ?? "No supplier"}
                        </span>
                      )}
                    </span>
```

(This replaces the existing bare `<span className="flex-1">{item.name}</span>`.)

- [ ] **Step 4: Run it, confirm it passes**

Run: `npx vitest run app/admin/catalog/reference/ReferenceSection.test.tsx`
Expected: PASS, including every pre-existing test in the file (Genres/ProductTypes/Artists paths are unaffected since `supplierEndpoint` is `undefined` for them).

- [ ] **Step 5: Wire Labels' supplier data into the reference page**

In `app/admin/catalog/reference/page.tsx`, change the Labels query to include `supplier` and map it through:

```tsx
type LabelWithCount = WithCount & { supplier: { id: string; name: string } | null };

const toLabelItems = (rows: LabelWithCount[]): ReferenceItem[] =>
  rows.map((r) => ({
    id: r.id,
    name: r.name,
    productCount: r._count.products,
    supplierId: r.supplier?.id ?? null,
    supplierName: r.supplier?.name ?? null,
  }));
```

Change the `labels` query in the `Promise.all` from `db.label.findMany(firstPage)` to:

```tsx
    db.label.findMany({ ...firstPage, include: { ...firstPage.include, supplier: true } }),
```

Change `toItems(labels)` to `toLabelItems(labels)` in the JSX, and add `supplierEndpoint="/api/admin/suppliers"` to the Labels `<ReferenceSection>`:

```tsx
        <ReferenceSection
          title="Labels"
          endpoint="/api/admin/labels"
          initialItems={toLabelItems(labels)}
          initialTotal={labelTotal}
          supplierEndpoint="/api/admin/suppliers"
        />
```

- [ ] **Step 6: Run the reference page test, confirm still green**

Run: `npx vitest run app/admin/catalog/reference/page.test.tsx`
Expected: PASS. If it fails because it asserts the exact `db.label.findMany` call args, update that assertion to match the new `include`.

- [ ] **Step 7: Commit**

```bash
git add app/admin/catalog/reference
git commit -m "feat: add an opt-in supplier picker to the Labels reference section"
```

---

## Task 5: ProductForm — Supplier field with create-only prefill from label

**Files:**
- Modify: `components/admin/ProductForm.tsx`
- Modify: `components/admin/ProductForm.test.tsx`
- Modify: `app/admin/catalog/[id]/edit/page.tsx`

**Interfaces:**
- Consumes: `Task 3`'s `supplierId` in the product create/update payload; `Task 2`'s labels typeahead carrying `supplierId`/`supplierName` per item.
- Produces: `ProductFormValues` gains `supplier: ComboboxOption | null`. No other task depends on this directly — it's the last piece of the supplier-linkage chain.

- [ ] **Step 1: Write the failing tests**

Read `ProductForm.test.tsx` in full first to match its existing mock/render setup (it likely already mocks `fetch` for the Combobox typeaheads), then add:

```tsx
it("submits supplierId: null when no supplier is picked", async () => {
  const user = userEvent.setup();
  renderNewProductForm(); // however the file's existing tests render a create-mode form — reuse that helper/setup
  await fillRequiredFields(user); // reuse the existing helper that fills artist/title/label/genre/type/price
  await user.click(screen.getByRole("button", { name: /add product/i }));
  expect(global.fetch).toHaveBeenCalledWith(
    "/api/admin/products",
    expect.objectContaining({
      body: expect.stringContaining('"supplierId":null'),
    }),
  );
});

it("prefills the supplier from the selected label when creating, without overwriting a manual pick", async () => {
  const user = userEvent.setup();
  vi.mocked(global.fetch).mockImplementation(async (input) => {
    const url = String(input);
    if (url.startsWith("/api/admin/labels")) {
      return {
        ok: true,
        json: async () => [{ id: "l1", name: "Warp", supplierId: "s1", supplierName: "Beta Distro" }],
      } as Response;
    }
    return { ok: true, json: async () => [] } as Response;
  });
  renderNewProductForm();
  await user.click(screen.getByLabelText(/^label$/i));
  await user.click(await screen.findByRole("option", { name: "Warp" }));
  expect(screen.getByLabelText(/^supplier$/i)).toHaveValue("Beta Distro");
});
```

(Adapt `renderNewProductForm`/`fillRequiredFields` to whatever the existing test file's actual helper names are — read the file first; don't invent helpers that don't exist there. If the file has no such helpers and instead inlines setup per test, inline these two the same way.)

- [ ] **Step 2: Run it, confirm it fails**

Run: `npx vitest run components/admin/ProductForm.test.tsx`
Expected: FAIL — no Supplier field exists yet, submitted body has no `supplierId`.

- [ ] **Step 3: Implement**

In `ProductForm.tsx`, add `supplier` to `ProductFormValues`:

```ts
export interface ProductFormValues {
  id: string;
  artists: ComboboxOption[];
  title: string;
  catalogNumber: string | null;
  label: ComboboxOption;
  genre: ComboboxOption;
  productType: ComboboxOption;
  supplier: ComboboxOption | null;
  condition: "NEW" | "SECONDHAND";
  price: string;
  description: string | null;
  coverImage: string | null;
  quantity: number;
}
```

Add state:

```tsx
  const [supplier, setSupplier] = useState<ComboboxOption | null>(product?.supplier ?? null);
```

Change the Label `Combobox`'s `onChange` to opportunistically prefill supplier on create when nothing's been picked yet:

```tsx
      <Field label="Label" htmlFor="label">
        <Combobox
          id="label"
          label="Label"
          endpoint="/api/admin/labels"
          value={label}
          onChange={(option) => {
            setLabel(option);
            if (!product && !supplier) {
              const withSupplier = option as ComboboxOption & {
                supplierId?: string | null;
                supplierName?: string | null;
              };
              if (withSupplier.supplierId) {
                setSupplier({ id: withSupplier.supplierId, name: withSupplier.supplierName ?? "" });
              }
            }
          }}
          required
        />
      </Field>
```

Add a new `Field` for Supplier, right after the Product type field:

```tsx
      <Field label="Supplier" htmlFor="supplier">
        <Combobox
          id="supplier"
          label="Supplier"
          endpoint="/api/admin/suppliers"
          value={supplier}
          onChange={setSupplier}
          allowCreate={false}
        />
      </Field>
```

Add `supplierId: supplier?.id ?? null,` to the `handleSubmit` body's JSON payload, alongside `productTypeId`.

- [ ] **Step 4: Run it, confirm it passes**

Run: `npx vitest run components/admin/ProductForm.test.tsx`
Expected: PASS, including every pre-existing test.

- [ ] **Step 5: Wire supplier into the edit page**

In `app/admin/catalog/[id]/edit/page.tsx`, add `supplier: true` to the `db.product.findUnique` include:

```tsx
  const product = await db.product.findUnique({
    where: { id },
    include: {
      label: true,
      genre: true,
      productType: true,
      supplier: true,
      productArtists: { include: { artist: true }, orderBy: { position: "asc" } },
    },
  });
```

Add `supplier` to the `ProductForm` props object:

```tsx
          supplier: product.supplier
            ? { id: product.supplier.id, name: product.supplier.name }
            : null,
```

(placed alongside the existing `productType:` line).

- [ ] **Step 6: Run the edit page test, confirm still green**

Run: `npx vitest run app/admin/catalog/\[id\]/edit`
Expected: PASS. If a test file doesn't exist for this page, skip this step — check first with `find app/admin/catalog/\[id\] -name "*.test.tsx"`.

- [ ] **Step 7: Commit**

```bash
git add components/admin/ProductForm.tsx components/admin/ProductForm.test.tsx \
  app/admin/catalog/\[id\]/edit/page.tsx
git commit -m "feat: add Supplier field to ProductForm with create-time prefill from label"
```

---

## Task 6: lib/supply-order-quick-add.ts + POST /api/admin/orders/quick-add

**Files:**
- Create: `lib/supply-order-quick-add.ts`
- Create: `lib/supply-order-quick-add.test.ts`
- Create: `app/api/admin/orders/quick-add/route.ts`
- Create: `app/api/admin/orders/quick-add/route.test.ts`

**Interfaces:**
- Consumes: `Product.supplierId` (Task 1), `SupplyOrder`/`SupplyOrderLine` (existing schema).
- Produces: `quickAddToOrder(tx: Prisma.TransactionClient, input: { productId: string }): Promise<QuickAddResult>` where `QuickAddResult = { ok: true; status: 200 | 201; line: SupplyOrderLine } | { ok: false; status: 400 | 409; error: string }`. `POST /api/admin/orders/quick-add` (body `{ productId }`) is what Task 8's `OrderButton` calls.

"Open" order = `status in [PENDING, SENT, PARTIAL]` (only `RECEIVED` is terminal), per the approved spec.

- [ ] **Step 1: Write the failing tests**

```ts
// lib/supply-order-quick-add.test.ts
// @vitest-environment node
import { describe, it, expect, vi, type Mock } from "vitest";

import { quickAddToOrder } from "@/lib/supply-order-quick-add";

function makeTx() {
  return {
    product: { findUnique: vi.fn() },
    supplyOrder: { findFirst: vi.fn(), create: vi.fn() },
    supplyOrderLine: { create: vi.fn() },
  };
}
type Tx = ReturnType<typeof makeTx>;
const asTx = (tx: Tx) => tx as unknown as Parameters<typeof quickAddToOrder>[0];

describe("quickAddToOrder", () => {
  it("400s a product with no supplier, without querying orders", async () => {
    const tx = makeTx();
    (tx.product.findUnique as Mock).mockResolvedValue({ supplierId: null });
    const result = await quickAddToOrder(asTx(tx), { productId: "p1" });
    expect(result).toEqual({ ok: false, status: 400, error: "Product has no supplier" });
    expect(tx.supplyOrder.findFirst).not.toHaveBeenCalled();
  });

  it("creates a new PENDING order when none is open for the supplier", async () => {
    const tx = makeTx();
    (tx.product.findUnique as Mock).mockResolvedValue({ supplierId: "s1" });
    (tx.supplyOrder.findFirst as Mock).mockResolvedValue(null);
    (tx.supplyOrder.create as Mock).mockResolvedValue({
      id: "o1",
      lines: [{ id: "l1", supplyOrderId: "o1", productId: "p1", quantityOrdered: 1, quantityReceived: 0 }],
    });

    const result = await quickAddToOrder(asTx(tx), { productId: "p1" });

    expect(result).toEqual({
      ok: true,
      status: 201,
      line: { id: "l1", supplyOrderId: "o1", productId: "p1", quantityOrdered: 1, quantityReceived: 0 },
    });
    expect(tx.supplyOrder.create).toHaveBeenCalledWith({
      data: {
        supplierId: "s1",
        orderedAt: expect.any(Date),
        lines: { create: [{ productId: "p1", quantityOrdered: 1 }] },
      },
      include: { lines: true },
    });
  });

  it("searches PENDING, SENT, and PARTIAL as open when looking for an existing order", async () => {
    const tx = makeTx();
    (tx.product.findUnique as Mock).mockResolvedValue({ supplierId: "s1" });
    (tx.supplyOrder.findFirst as Mock).mockResolvedValue({ id: "o1", status: "SENT", lines: [] });
    (tx.supplyOrderLine.create as Mock).mockResolvedValue({
      id: "l2", supplyOrderId: "o1", productId: "p1", quantityOrdered: 1, quantityReceived: 0,
    });

    const result = await quickAddToOrder(asTx(tx), { productId: "p1" });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.status).toBe(200);
    expect(tx.supplyOrder.findFirst).toHaveBeenCalledWith({
      where: { supplierId: "s1", status: { in: ["PENDING", "SENT", "PARTIAL"] } },
      include: { lines: true },
    });
    expect(tx.supplyOrderLine.create).toHaveBeenCalledWith({
      data: { supplyOrderId: "o1", productId: "p1", quantityOrdered: 1 },
    });
  });

  it("409s when the product already has a line in the open order, without creating a line", async () => {
    const tx = makeTx();
    (tx.product.findUnique as Mock).mockResolvedValue({ supplierId: "s1" });
    (tx.supplyOrder.findFirst as Mock).mockResolvedValue({
      id: "o1",
      status: "PENDING",
      lines: [{ id: "l1", productId: "p1" }],
    });

    const result = await quickAddToOrder(asTx(tx), { productId: "p1" });

    expect(result).toEqual({ ok: false, status: 409, error: "Product already in open order" });
    expect(tx.supplyOrderLine.create).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run it, confirm it fails**

Run: `npx vitest run lib/supply-order-quick-add.test.ts`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement**

```ts
// lib/supply-order-quick-add.ts
import type { Prisma, SupplyOrderLine } from "@prisma/client";

export type QuickAddResult =
  | { ok: true; status: 200 | 201; line: SupplyOrderLine }
  | { ok: false; status: 400 | 409; error: string };

const OPEN_STATUSES = ["PENDING", "SENT", "PARTIAL"] as const;

// Finds or creates the supplier's single open (non-RECEIVED) SupplyOrder and
// adds a one-quantity line for productId. Caller wraps this in db.$transaction
// — the find-then-act sequence isn't otherwise atomic, and this is a
// single-operator internal tool (see the accepted concurrent-receive race in
// docs/features/stock-management.md for the same tradeoff already made here).
export async function quickAddToOrder(
  tx: Prisma.TransactionClient,
  input: { productId: string },
): Promise<QuickAddResult> {
  const product = await tx.product.findUnique({
    where: { id: input.productId },
    select: { supplierId: true },
  });
  if (!product?.supplierId) {
    return { ok: false, status: 400, error: "Product has no supplier" };
  }

  const openOrder = await tx.supplyOrder.findFirst({
    where: { supplierId: product.supplierId, status: { in: [...OPEN_STATUSES] } },
    include: { lines: true },
  });

  if (openOrder) {
    const existingLine = openOrder.lines.find((l) => l.productId === input.productId);
    if (existingLine) {
      return { ok: false, status: 409, error: "Product already in open order" };
    }
    const line = await tx.supplyOrderLine.create({
      data: { supplyOrderId: openOrder.id, productId: input.productId, quantityOrdered: 1 },
    });
    return { ok: true, status: 200, line };
  }

  const created = await tx.supplyOrder.create({
    data: {
      supplierId: product.supplierId,
      orderedAt: new Date(),
      lines: { create: [{ productId: input.productId, quantityOrdered: 1 }] },
    },
    include: { lines: true },
  });
  return { ok: true, status: 201, line: created.lines[0] };
}
```

- [ ] **Step 4: Run it, confirm it passes**

Run: `npx vitest run lib/supply-order-quick-add.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing route test**

```ts
// app/api/admin/orders/quick-add/route.test.ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

vi.mock("@/lib/api-auth", () => ({ requireAdmin: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/supply-order-quick-add", () => ({ quickAddToOrder: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { $transaction: vi.fn() } }));

import { db } from "@/lib/db";
import { quickAddToOrder } from "@/lib/supply-order-quick-add";
import { POST } from "@/app/api/admin/orders/quick-add/route";
import { requireAdmin } from "@/lib/api-auth";

const mockTransaction = db.$transaction as unknown as Mock;
const mockQuickAdd = quickAddToOrder as unknown as Mock;
const mockRequireAdmin = vi.mocked(requireAdmin);
const req = (body: unknown) =>
  new Request("http://t/x", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAdmin.mockResolvedValue(null);
  mockTransaction.mockImplementation((fn: (tx: unknown) => unknown) => fn({}));
});

describe("POST /api/admin/orders/quick-add", () => {
  it("400s a missing productId without starting a transaction", async () => {
    const res = await POST(req({}));
    expect(res.status).toBe(400);
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("returns the line with the result's status on success", async () => {
    mockQuickAdd.mockResolvedValue({ ok: true, status: 201, line: { id: "l1" } });
    const res = await POST(req({ productId: "p1" }));
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ id: "l1" });
  });

  it("surfaces a failure's status and error", async () => {
    mockQuickAdd.mockResolvedValue({ ok: false, status: 409, error: "Product already in open order" });
    const res = await POST(req({ productId: "p1" }));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "Product already in open order" });
  });
});
```

- [ ] **Step 6: Run it, confirm it fails**

Run: `npx vitest run app/api/admin/orders/quick-add`
Expected: FAIL — route doesn't exist.

- [ ] **Step 7: Implement the route**

```ts
// app/api/admin/orders/quick-add/route.ts
import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { quickAddToOrder } from "@/lib/supply-order-quick-add";

export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const body = (await req.json().catch(() => null)) as { productId?: unknown } | null;
  const productId = typeof body?.productId === "string" ? body.productId.trim() : "";
  if (!productId) {
    return NextResponse.json({ error: "productId is required" }, { status: 400 });
  }

  const result = await db.$transaction((tx) => quickAddToOrder(tx, { productId }));
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result.line, { status: result.status });
}
```

- [ ] **Step 8: Run it, confirm it passes**

Run: `npx vitest run app/api/admin/orders/quick-add`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add lib/supply-order-quick-add.ts lib/supply-order-quick-add.test.ts \
  app/api/admin/orders/quick-add
git commit -m "feat: add quick-add-to-order for the product-driven ordering flow"
```

---

## Task 7: lib/open-order-lookup.ts

**Files:**
- Create: `lib/open-order-lookup.ts`
- Create: `lib/open-order-lookup.test.ts`

**Interfaces:**
- Produces: `getOpenOrderProductIds(productIds: string[]): Promise<Set<string>>`. Consumed by Task 9 (catalog list) and Task 20 (transactions page) to compute each row's "already ordered" button state without a per-row query.

- [ ] **Step 1: Write the failing tests**

```ts
// lib/open-order-lookup.test.ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

vi.mock("@/lib/db", () => ({ db: { supplyOrderLine: { findMany: vi.fn() } } }));

import { db } from "@/lib/db";
import { getOpenOrderProductIds } from "@/lib/open-order-lookup";

const findMany = (db.supplyOrderLine as unknown as { findMany: Mock }).findMany;

beforeEach(() => vi.clearAllMocks());

describe("getOpenOrderProductIds", () => {
  it("returns an empty set without querying when given no ids", async () => {
    const result = await getOpenOrderProductIds([]);
    expect(result).toEqual(new Set());
    expect(findMany).not.toHaveBeenCalled();
  });

  it("returns the set of product ids with a line on a non-RECEIVED order", async () => {
    findMany.mockResolvedValue([{ productId: "p1" }, { productId: "p3" }]);
    const result = await getOpenOrderProductIds(["p1", "p2", "p3"]);
    expect(result).toEqual(new Set(["p1", "p3"]));
    expect(findMany).toHaveBeenCalledWith({
      where: {
        productId: { in: ["p1", "p2", "p3"] },
        supplyOrder: { status: { not: "RECEIVED" } },
      },
      select: { productId: true },
    });
  });
});
```

- [ ] **Step 2: Run it, confirm it fails**

Run: `npx vitest run lib/open-order-lookup.test.ts`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement**

```ts
// lib/open-order-lookup.ts
import { db } from "@/lib/db";

// Product ids that already have a line on a non-RECEIVED SupplyOrder — lets
// the catalog list and transactions page compute each row's "Order"/"Ordered"
// button state with one query per page instead of one per row.
export async function getOpenOrderProductIds(productIds: string[]): Promise<Set<string>> {
  if (productIds.length === 0) return new Set();
  const lines = await db.supplyOrderLine.findMany({
    where: {
      productId: { in: productIds },
      supplyOrder: { status: { not: "RECEIVED" } },
    },
    select: { productId: true },
  });
  return new Set(lines.map((l) => l.productId));
}
```

- [ ] **Step 4: Run it, confirm it passes**

Run: `npx vitest run lib/open-order-lookup.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/open-order-lookup.ts lib/open-order-lookup.test.ts
git commit -m "feat: add getOpenOrderProductIds for Order-button state lookups"
```

---

## Task 8: components/admin/OrderButton.tsx

**Files:**
- Create: `components/admin/OrderButton.tsx`
- Create: `components/admin/OrderButton.test.tsx`

**Interfaces:**
- Consumes: `POST /api/admin/orders/quick-add` (Task 6).
- Produces: `<OrderButton productId hasSupplier initiallyOrdered />`. Consumed by Task 9 (catalog list) and Task 20 (transactions page).

- [ ] **Step 1: Write the failing tests**

```tsx
// components/admin/OrderButton.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { OrderButton } from "@/components/admin/OrderButton";

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("OrderButton", () => {
  it("is disabled with a 'No supplier linked' title when hasSupplier is false", () => {
    render(<OrderButton productId="p1" hasSupplier={false} initiallyOrdered={false} />);
    const button = screen.getByRole("button", { name: /order/i });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("title", "No supplier linked");
  });

  it("renders a disabled 'Ordered' button when initiallyOrdered is true", () => {
    render(<OrderButton productId="p1" hasSupplier initiallyOrdered />);
    const button = screen.getByRole("button", { name: /ordered/i });
    expect(button).toBeDisabled();
  });

  it("quick-adds on click and flips to a disabled 'Ordered' state", async () => {
    const user = userEvent.setup();
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ id: "l1" }),
    } as Response);
    render(<OrderButton productId="p1" hasSupplier initiallyOrdered={false} />);

    await user.click(screen.getByRole("button", { name: /^order$/i }));

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/admin/orders/quick-add",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ productId: "p1" }),
      }),
    );
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /ordered/i })).toBeDisabled();
    });
  });

  it("shows an error and stays clickable when the quick-add fails", async () => {
    const user = userEvent.setup();
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Product already in open order" }),
    } as Response);
    render(<OrderButton productId="p1" hasSupplier initiallyOrdered={false} />);

    await user.click(screen.getByRole("button", { name: /^order$/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Product already in open order");
    expect(screen.getByRole("button", { name: /^order$/i })).not.toBeDisabled();
  });
});
```

- [ ] **Step 2: Run it, confirm it fails**

Run: `npx vitest run components/admin/OrderButton.test.tsx`
Expected: FAIL — component doesn't exist.

- [ ] **Step 3: Implement**

```tsx
// components/admin/OrderButton.tsx
"use client";

import { useState } from "react";

import { apiSend } from "@/lib/api-client";
import { useAsyncAction } from "@/lib/use-async-action";

// Shared "Order" action for the catalog list and the monthly transactions
// page: quick-adds a product to its supplier's open SupplyOrder.
export function OrderButton({
  productId,
  hasSupplier,
  initiallyOrdered,
}: {
  productId: string;
  hasSupplier: boolean;
  initiallyOrdered: boolean;
}) {
  const [ordered, setOrdered] = useState(initiallyOrdered);
  const { pending, error, run } = useAsyncAction();

  function handleOrder() {
    run(async () => {
      await apiSend("/api/admin/orders/quick-add", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ productId }),
      });
      setOrdered(true);
    });
  }

  const disabled = pending || ordered || !hasSupplier;

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleOrder}
        disabled={disabled}
        title={!hasSupplier ? "No supplier linked" : undefined}
        className="rounded border border-admin-hairline px-2 py-1 text-xs hover:bg-admin-raised disabled:opacity-40"
      >
        {pending ? "…" : ordered ? "Ordered" : "Order"}
      </button>
      {error && (
        <span role="alert" className="text-xs text-red-400">
          {error}
        </span>
      )}
    </span>
  );
}
```

- [ ] **Step 4: Run it, confirm it passes**

Run: `npx vitest run components/admin/OrderButton.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/admin/OrderButton.tsx components/admin/OrderButton.test.tsx
git commit -m "feat: add shared OrderButton component"
```

---

## Task 9: Wire OrderButton into the catalog list

**Files:**
- Modify: `app/admin/catalog/page.tsx`
- Modify: `app/admin/catalog/catalog.test.tsx`

**Interfaces:**
- Consumes: `getOpenOrderProductIds` (Task 7), `<OrderButton>` (Task 8), `product.supplierId` (Task 1, already present on `CatalogProduct` — no `CATALOG_INCLUDE` change needed since scalar fields are always returned).

- [ ] **Step 1: Write the failing tests**

Add to `catalog.test.tsx` (mock `getOpenOrderProductIds` the same way the file already mocks `getCatalogPage`):

```tsx
vi.mock("@/lib/open-order-lookup", () => ({ getOpenOrderProductIds: vi.fn() }));
```

```tsx
import { getOpenOrderProductIds } from "@/lib/open-order-lookup";
```

Add to the shared `beforeEach`: `vi.mocked(getOpenOrderProductIds).mockResolvedValue(new Set());`

```tsx
it("shows a disabled Order button with a tooltip when the product has no supplier", async () => {
  vi.mocked(getCatalogPage).mockResolvedValue({
    products: [{ ...PRODUCT, supplierId: null }] as never,
    total: 1,
    page: 1,
    pageCount: 1,
  });
  const ui = await AdminCatalogPage({ searchParams: Promise.resolve({}) });
  render(ui);
  const button = screen.getByRole("button", { name: /order/i });
  expect(button).toBeDisabled();
  expect(button).toHaveAttribute("title", "No supplier linked");
});

it("shows a disabled 'Ordered' button when the product is already in an open order", async () => {
  vi.mocked(getCatalogPage).mockResolvedValue({
    products: [{ ...PRODUCT, supplierId: "s1" }] as never,
    total: 1,
    page: 1,
    pageCount: 1,
  });
  vi.mocked(getOpenOrderProductIds).mockResolvedValue(new Set(["p1"]));
  const ui = await AdminCatalogPage({ searchParams: Promise.resolve({}) });
  render(ui);
  expect(screen.getByRole("button", { name: /ordered/i })).toBeDisabled();
});
```

- [ ] **Step 2: Run it, confirm it fails**

Run: `npx vitest run app/admin/catalog/catalog.test.tsx`
Expected: FAIL — no Order button rendered yet.

- [ ] **Step 3: Implement**

In `app/admin/catalog/page.tsx`, add imports:

```tsx
import { getOpenOrderProductIds } from "@/lib/open-order-lookup";
import { OrderButton } from "@/components/admin/OrderButton";
```

After `const result = await getCatalogPage({...});`, add:

```tsx
  const openOrderProductIds = await getOpenOrderProductIds(
    result.products.map((p) => p.id),
  );
```

In the row's actions `<div className="flex items-center gap-3">`, add the button next to `SellOneButton`:

```tsx
                  <SellOneButton id={product.id} quantity={product.quantity} />
                  <OrderButton
                    productId={product.id}
                    hasSupplier={!!product.supplierId}
                    initiallyOrdered={openOrderProductIds.has(product.id)}
                  />
```

- [ ] **Step 4: Run it, confirm it passes**

Run: `npx vitest run app/admin/catalog/catalog.test.tsx`
Expected: PASS, including every pre-existing test (the `PRODUCT` fixture will need `supplierId: "s1"` added, or the new no-supplier test will collide with the default fixture's shape — check the fixture, add `supplierId: "s1"` to the base `PRODUCT` object so pre-existing tests keep an enabled button by default).

- [ ] **Step 5: Commit**

```bash
git add app/admin/catalog/page.tsx app/admin/catalog/catalog.test.tsx
git commit -m "feat: add Order button to each catalog list row"
```

---

## Task 10: lib/order-line-input.ts + PATCH /api/admin/orders/lines/[id]

**Files:**
- Create: `lib/order-line-input.ts`
- Create: `lib/order-line-input.test.ts`
- Create: `app/api/admin/orders/lines/[id]/route.ts`
- Create: `app/api/admin/orders/lines/[id]/route.test.ts`

**Interfaces:**
- Produces: `parseOrderLineQuantityInput(body: unknown): { ok: true; data: { quantityOrdered: number } } | { ok: false; error: string }`. `PATCH /api/admin/orders/lines/[id]` (body `{ quantityOrdered }`) — 400 if not a positive integer, 400 if less than the line's current `quantityReceived`, 404 if the line doesn't exist, 409 if the parent order is `RECEIVED`. Consumed by Task 15's `OrderLineRow`.

- [ ] **Step 1: Write the failing tests for the parser**

```ts
// lib/order-line-input.test.ts
// @vitest-environment node
import { describe, it, expect } from "vitest";

import { parseOrderLineQuantityInput } from "@/lib/order-line-input";

describe("parseOrderLineQuantityInput", () => {
  it("accepts a positive integer", () => {
    expect(parseOrderLineQuantityInput({ quantityOrdered: 5 })).toEqual({
      ok: true,
      data: { quantityOrdered: 5 },
    });
  });

  it("rejects zero, negative, non-integer, and missing values", () => {
    for (const bad of [{ quantityOrdered: 0 }, { quantityOrdered: -1 }, { quantityOrdered: 1.5 }, {}]) {
      expect(parseOrderLineQuantityInput(bad)).toEqual({
        ok: false,
        error: "quantityOrdered must be a positive whole number",
      });
    }
  });
});
```

- [ ] **Step 2: Run it, confirm it fails**

Run: `npx vitest run lib/order-line-input.test.ts`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement the parser**

```ts
// lib/order-line-input.ts
export interface OrderLineQuantityInput {
  quantityOrdered: number;
}

export type ParseResult =
  | { ok: true; data: OrderLineQuantityInput }
  | { ok: false; error: string };

export function parseOrderLineQuantityInput(body: unknown): ParseResult {
  const b = (body ?? {}) as Record<string, unknown>;
  const quantityOrdered = typeof b.quantityOrdered === "number" ? b.quantityOrdered : NaN;
  if (!Number.isInteger(quantityOrdered) || quantityOrdered <= 0) {
    return { ok: false, error: "quantityOrdered must be a positive whole number" };
  }
  return { ok: true, data: { quantityOrdered } };
}
```

- [ ] **Step 4: Run it, confirm it passes**

Run: `npx vitest run lib/order-line-input.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing route tests**

```ts
// app/api/admin/orders/lines/[id]/route.test.ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

vi.mock("@/lib/api-auth", () => ({ requireAdmin: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/db", () => ({
  db: { supplyOrderLine: { findUnique: vi.fn(), update: vi.fn() } },
}));

import { db } from "@/lib/db";
import { PATCH } from "@/app/api/admin/orders/lines/[id]/route";
import { requireAdmin } from "@/lib/api-auth";

const line = db.supplyOrderLine as unknown as { findUnique: Mock; update: Mock };
const mockRequireAdmin = vi.mocked(requireAdmin);
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const req = (body: unknown) =>
  new Request("http://t/x", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAdmin.mockResolvedValue(null);
});

describe("PATCH /api/admin/orders/lines/[id]", () => {
  it("updates quantityOrdered on a line whose order is still open", async () => {
    line.findUnique.mockResolvedValue({
      id: "l1",
      quantityReceived: 2,
      supplyOrder: { status: "PENDING" },
    });
    line.update.mockResolvedValue({ id: "l1", quantityOrdered: 6 });
    const res = await PATCH(req({ quantityOrdered: 6 }), ctx("l1"));
    expect(res.status).toBe(200);
    expect(line.update).toHaveBeenCalledWith({
      where: { id: "l1" },
      data: { quantityOrdered: 6 },
    });
  });

  it("400s a quantity below what's already been received, without writing", async () => {
    line.findUnique.mockResolvedValue({
      id: "l1",
      quantityReceived: 5,
      supplyOrder: { status: "PARTIAL" },
    });
    const res = await PATCH(req({ quantityOrdered: 3 }), ctx("l1"));
    expect(res.status).toBe(400);
    expect(line.update).not.toHaveBeenCalled();
  });

  it("404s an unknown line", async () => {
    line.findUnique.mockResolvedValue(null);
    const res = await PATCH(req({ quantityOrdered: 3 }), ctx("missing"));
    expect(res.status).toBe(404);
  });

  it("409s a line on a RECEIVED order, without writing", async () => {
    line.findUnique.mockResolvedValue({
      id: "l1",
      quantityReceived: 5,
      supplyOrder: { status: "RECEIVED" },
    });
    const res = await PATCH(req({ quantityOrdered: 5 }), ctx("l1"));
    expect(res.status).toBe(409);
    expect(line.update).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 6: Run it, confirm it fails**

Run: `npx vitest run app/api/admin/orders/lines/\[id\]/route.test.ts`
Expected: FAIL — route doesn't exist.

- [ ] **Step 7: Implement the route**

```ts
// app/api/admin/orders/lines/[id]/route.ts
import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { parseOrderLineQuantityInput } from "@/lib/order-line-input";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: RouteContext) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await ctx.params;

  const parsed = parseOrderLineQuantityInput(await req.json().catch(() => null));
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const line = await db.supplyOrderLine.findUnique({
    where: { id },
    include: { supplyOrder: true },
  });
  if (!line) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (line.supplyOrder.status === "RECEIVED") {
    return NextResponse.json(
      { error: "Cannot edit a line on a fully received order" },
      { status: 409 },
    );
  }
  if (parsed.data.quantityOrdered < line.quantityReceived) {
    return NextResponse.json(
      { error: `Cannot set quantity below the ${line.quantityReceived} already received` },
      { status: 400 },
    );
  }

  const updated = await db.supplyOrderLine.update({
    where: { id },
    data: { quantityOrdered: parsed.data.quantityOrdered },
  });
  return NextResponse.json(updated);
}
```

- [ ] **Step 8: Run it, confirm it passes**

Run: `npx vitest run app/api/admin/orders/lines/\[id\]/route.test.ts`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add lib/order-line-input.ts lib/order-line-input.test.ts \
  app/api/admin/orders/lines/\[id\]/route.ts app/api/admin/orders/lines/\[id\]/route.test.ts
git commit -m "feat: add inline quantityOrdered editing for open order lines"
```

---

## Task 11: PATCH /api/admin/orders/lines/[id]/receive

**Files:**
- Create: `app/api/admin/orders/lines/[id]/receive/route.ts`
- Create: `app/api/admin/orders/lines/[id]/receive/route.test.ts`

**Interfaces:**
- Consumes: `applyStockTransaction` (existing `lib/stock.ts`, unchanged).
- Produces: `PATCH /api/admin/orders/lines/[id]/receive` (body `{ quantityReceived }`, an increment). Creates an `IN` `StockTransaction`, increments the line's `quantityReceived`, recomputes and persists the parent order's status (`RECEIVED` if every line is full, else `PARTIAL`) and bumps `receivedAt`. This becomes the sole receiving path — the old whole-order `POST /api/admin/orders/[id]/receive` is removed in Task 12. Consumed by Task 15's `OrderLineRow`.

- [ ] **Step 1: Write the failing tests**

Model these closely on the existing `app/api/admin/orders/[id]/receive/route.test.ts` (read it first — it's being deleted in Task 12, but its test-double pattern for `tx` is exactly right to reuse here), scoped to a single line instead of a batch:

```ts
// app/api/admin/orders/lines/[id]/receive/route.test.ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

vi.mock("@/lib/api-auth", () => ({ requireAdmin: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/stock", () => ({ applyStockTransaction: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: { supplyOrderLine: { findUnique: vi.fn() }, $transaction: vi.fn() },
}));

import { db } from "@/lib/db";
import { applyStockTransaction } from "@/lib/stock";
import { PATCH } from "@/app/api/admin/orders/lines/[id]/receive/route";
import { requireAdmin } from "@/lib/api-auth";

const line = db.supplyOrderLine as unknown as { findUnique: Mock };
const mockTransaction = db.$transaction as unknown as Mock;
const mockApply = applyStockTransaction as unknown as Mock;
const mockRequireAdmin = vi.mocked(requireAdmin);
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const req = (body: unknown) =>
  new Request("http://t/x", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

// Distinct from `db` on purpose — see the comment in the (now-removed)
// whole-order receive route's test this was modeled on: reusing `db` as
// `tx` would hide a regression to a non-transactional write.
const tx = {
  supplyOrderLine: { update: vi.fn(), findMany: vi.fn() },
  supplyOrder: { update: vi.fn() },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAdmin.mockResolvedValue(null);
  mockTransaction.mockImplementation((fn: (tx: unknown) => unknown) => fn(tx));
});

const LINE = {
  id: "l1",
  productId: "p1",
  quantityOrdered: 5,
  quantityReceived: 0,
  supplyOrderId: "o1",
};

describe("PATCH /api/admin/orders/lines/[id]/receive", () => {
  it("applies an IN transaction, increments the line, and sets order status PARTIAL when under-received", async () => {
    line.findUnique.mockResolvedValue(LINE);
    mockApply.mockResolvedValue({ ok: true, quantity: 3, appliedQuantity: 3 });
    tx.supplyOrderLine.update.mockResolvedValue({});
    tx.supplyOrderLine.findMany.mockResolvedValue([{ ...LINE, quantityReceived: 3 }]);
    tx.supplyOrder.update.mockResolvedValue({ id: "o1", status: "PARTIAL" });

    const res = await PATCH(req({ quantityReceived: 3 }), ctx("l1"));

    expect(res.status).toBe(200);
    expect(mockApply).toHaveBeenCalledWith(tx, {
      productId: "p1",
      type: "IN",
      requestedQuantity: 3,
      note: "Received from supply order",
      supplyOrderLineId: "l1",
    });
    expect(tx.supplyOrderLine.update).toHaveBeenCalledWith({
      where: { id: "l1" },
      data: { quantityReceived: { increment: 3 } },
    });
    expect(tx.supplyOrder.update).toHaveBeenCalledWith({
      where: { id: "o1" },
      data: { status: "PARTIAL", receivedAt: expect.any(Date) },
    });
  });

  it("sets order status RECEIVED once every line on the order is fully received", async () => {
    line.findUnique.mockResolvedValue(LINE);
    mockApply.mockResolvedValue({ ok: true, quantity: 5, appliedQuantity: 5 });
    tx.supplyOrderLine.update.mockResolvedValue({});
    tx.supplyOrderLine.findMany.mockResolvedValue([{ ...LINE, quantityReceived: 5 }]);
    tx.supplyOrder.update.mockResolvedValue({ id: "o1", status: "RECEIVED" });

    const res = await PATCH(req({ quantityReceived: 5 }), ctx("l1"));

    expect(res.status).toBe(200);
    expect(tx.supplyOrder.update).toHaveBeenCalledWith({
      where: { id: "o1" },
      data: { status: "RECEIVED", receivedAt: expect.any(Date) },
    });
  });

  it("400s receiving more than the remaining quantity, without applying anything", async () => {
    line.findUnique.mockResolvedValue({ ...LINE, quantityReceived: 3 });
    const res = await PATCH(req({ quantityReceived: 3 }), ctx("l1")); // 3 + 3 > 5 ordered
    expect(res.status).toBe(400);
    expect(mockApply).not.toHaveBeenCalled();
  });

  it("400s a zero or negative quantityReceived", async () => {
    line.findUnique.mockResolvedValue(LINE);
    const res = await PATCH(req({ quantityReceived: 0 }), ctx("l1"));
    expect(res.status).toBe(400);
    expect(mockApply).not.toHaveBeenCalled();
  });

  it("404s an unknown line", async () => {
    line.findUnique.mockResolvedValue(null);
    const res = await PATCH(req({ quantityReceived: 1 }), ctx("missing"));
    expect(res.status).toBe(404);
  });

  it("returns a clean 400, not a 500, when applyStockTransaction fails inside the transaction", async () => {
    line.findUnique.mockResolvedValue(LINE);
    mockApply.mockResolvedValue({ ok: false, error: "Product not found" });
    const res = await PATCH(req({ quantityReceived: 3 }), ctx("l1"));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Product not found");
  });
});
```

- [ ] **Step 2: Run it, confirm it fails**

Run: `npx vitest run app/api/admin/orders/lines/\[id\]/receive/route.test.ts`
Expected: FAIL — route doesn't exist.

- [ ] **Step 3: Implement**

```ts
// app/api/admin/orders/lines/[id]/receive/route.ts
import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { applyStockTransaction } from "@/lib/stock";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: RouteContext) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await ctx.params;

  const body = (await req.json().catch(() => null)) as { quantityReceived?: unknown } | null;
  const quantityReceived =
    typeof body?.quantityReceived === "number" ? body.quantityReceived : NaN;
  if (!Number.isInteger(quantityReceived) || quantityReceived <= 0) {
    return NextResponse.json(
      { error: "quantityReceived must be a positive whole number" },
      { status: 400 },
    );
  }

  const line = await db.supplyOrderLine.findUnique({ where: { id } });
  if (!line) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (line.quantityReceived + quantityReceived > line.quantityOrdered) {
    return NextResponse.json(
      { error: "Cannot receive more than ordered for this line" },
      { status: 400 },
    );
  }

  let updatedOrder;
  try {
    updatedOrder = await db.$transaction(async (tx) => {
      const result = await applyStockTransaction(tx, {
        productId: line.productId,
        type: "IN",
        requestedQuantity: quantityReceived,
        note: "Received from supply order",
        supplyOrderLineId: line.id,
      });
      if (!result.ok) throw new Error(result.error);

      await tx.supplyOrderLine.update({
        where: { id: line.id },
        data: { quantityReceived: { increment: quantityReceived } },
      });

      const freshLines = await tx.supplyOrderLine.findMany({
        where: { supplyOrderId: line.supplyOrderId },
      });
      const fullyReceived = freshLines.every((l) => l.quantityReceived >= l.quantityOrdered);

      return tx.supplyOrder.update({
        where: { id: line.supplyOrderId },
        data: { status: fullyReceived ? "RECEIVED" : "PARTIAL", receivedAt: new Date() },
      });
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to receive line" },
      { status: 400 },
    );
  }

  return NextResponse.json(updatedOrder);
}
```

- [ ] **Step 4: Run it, confirm it passes**

Run: `npx vitest run app/api/admin/orders/lines/\[id\]/receive/route.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/orders/lines/\[id\]/receive
git commit -m "feat: add per-line receive endpoint"
```

---

## Task 12: Repurpose PATCH /api/admin/orders/[id] for status-only; remove superseded routes

**Files:**
- Modify: `app/api/admin/orders/[id]/route.ts` (drop GET, rewrite PATCH, keep DELETE's guard exactly as-is)
- Modify: `app/api/admin/orders/[id]/route.test.ts` (rewrite for the new PATCH contract, drop the old GET describe block)
- Delete: `app/api/admin/orders/[id]/receive/route.ts`
- Delete: `app/api/admin/orders/[id]/receive/route.test.ts`
- Modify: `app/api/admin/orders/route.ts` — placeholder edit here; the real rewrite (dropping POST, changing GET's contract to `groupBy`) happens in Task 13 once `lib/order-overview.ts` exists. **Skip this file in this task** — noted here only so the removal of its POST handler and old test isn't missed later.

**Interfaces:**
- Produces: `PATCH /api/admin/orders/[id]` now only accepts `{ status: "SENT" }` — allowed from any non-`RECEIVED` status, no-op if already `SENT`, 404 if the order doesn't exist, 409 if `RECEIVED`, 400 for any other body shape. `DELETE` keeps its exact current behavior (404 if missing, 409 unless `status === "PENDING"`, else hard delete). Consumed by Task 16's `SupplierOrderGroup` ("Mark all as sent").

Confirmed via a codebase search that nothing outside the pages/components removed in Task 18 calls `GET /api/admin/orders/[id]` — safe to drop as dead code once those callers are gone. This task removes the route handler now; Task 18 removes its last callers.

- [ ] **Step 1: Write the failing tests for the new PATCH contract**

Replace the existing `PATCH` describe block in `app/api/admin/orders/[id]/route.test.ts` (delete the old "replaces the line set" and "409s a non-PENDING order" cases — that behavior is gone) with:

```ts
describe("PATCH /api/admin/orders/[id]", () => {
  it("marks a PENDING order as SENT", async () => {
    order.findUnique.mockResolvedValue({ id: "o1", status: "PENDING" });
    order.update.mockResolvedValue({ id: "o1", status: "SENT" });
    const res = await PATCH(patchReq({ status: "SENT" }), ctx("o1"));
    expect(res.status).toBe(200);
    expect(order.update).toHaveBeenCalledWith({ where: { id: "o1" }, data: { status: "SENT" } });
  });

  it("is a no-op success on an already-SENT order", async () => {
    order.findUnique.mockResolvedValue({ id: "o1", status: "SENT" });
    order.update.mockResolvedValue({ id: "o1", status: "SENT" });
    const res = await PATCH(patchReq({ status: "SENT" }), ctx("o1"));
    expect(res.status).toBe(200);
  });

  it("409s a RECEIVED order without writing", async () => {
    order.findUnique.mockResolvedValue({ id: "o1", status: "RECEIVED" });
    const res = await PATCH(patchReq({ status: "SENT" }), ctx("o1"));
    expect(res.status).toBe(409);
    expect(order.update).not.toHaveBeenCalled();
  });

  it("400s any body other than { status: 'SENT' }", async () => {
    const res = await PATCH(patchReq({ status: "RECEIVED" }), ctx("o1"));
    expect(res.status).toBe(400);
    expect(order.findUnique).not.toHaveBeenCalled();
  });

  it("404s an unknown order", async () => {
    order.findUnique.mockResolvedValue(null);
    const res = await PATCH(patchReq({ status: "SENT" }), ctx("missing"));
    expect(res.status).toBe(404);
  });
});
```

Remove the `describe("GET /api/admin/orders/[id]", ...)` block and its `GET` import entirely. Update the top-of-file `vi.mock("@/lib/db", ...)` mock shape if it references fields the old handlers needed but the new ones don't (it already mocks `findUnique`/`update`/`delete`, which is exactly what's still needed — no change required there). The `DELETE` describe block stays as-is (its two tests already match the unchanged guard).

- [ ] **Step 2: Run it, confirm it fails**

Run: `npx vitest run app/api/admin/orders/\[id\]/route.test.ts`
Expected: FAIL — route still does line-replacement.

- [ ] **Step 3: Rewrite the route**

```ts
// app/api/admin/orders/[id]/route.ts
import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";

type RouteContext = { params: Promise<{ id: string }> };

// GET (single-order detail) and PATCH's old "replace all lines" behavior
// were removed along with the manual order create/edit/detail pages they
// served (see Task 18) — ordering is now purely product-driven (quick-add)
// plus the grouped overview page's inline actions. This file now only
// supports "mark all as sent" and cancelling a mistaken order.

export async function PATCH(req: Request, ctx: RouteContext) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await ctx.params;

  const body = (await req.json().catch(() => null)) as { status?: unknown } | null;
  if (body?.status !== "SENT") {
    return NextResponse.json(
      { error: 'Only { status: "SENT" } is supported' },
      { status: 400 },
    );
  }

  const existing = await db.supplyOrder.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (existing.status === "RECEIVED") {
    return NextResponse.json(
      { error: "This order has already been fully received" },
      { status: 409 },
    );
  }

  const updated = await db.supplyOrder.update({ where: { id }, data: { status: "SENT" } });
  return NextResponse.json(updated);
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

- [ ] **Step 4: Run it, confirm it passes**

Run: `npx vitest run app/api/admin/orders/\[id\]/route.test.ts`
Expected: PASS.

- [ ] **Step 5: Delete the whole-order receive route and its test**

```bash
git rm app/api/admin/orders/\[id\]/receive/route.ts app/api/admin/orders/\[id\]/receive/route.test.ts
```

(Superseded by Task 11's per-line `PATCH /api/admin/orders/lines/[id]/receive` — this is a deliberate interface removal pre-approved by the spec, per the Test Contract.)

- [ ] **Step 6: Run the full orders API test directory, confirm green**

Run: `npx vitest run app/api/admin/orders`
Expected: PASS (the `orders.test.ts` file covering `route.ts`'s old `POST`/`GET` will still fail here — that's expected and fixed in Task 13, not this one; if your test runner reports it, note it and proceed, don't fix it in this task).

- [ ] **Step 7: Commit**

```bash
git add app/api/admin/orders/\[id\]/route.ts app/api/admin/orders/\[id\]/route.test.ts
git commit -m "feat: repurpose PATCH /api/admin/orders/[id] for mark-as-sent; remove whole-order receive"
```

---

## Task 13: lib/order-overview.ts + rewrite GET /api/admin/orders

**Files:**
- Create: `lib/order-overview.ts`
- Create: `lib/order-overview.test.ts`
- Modify: `app/api/admin/orders/route.ts` (drop `POST` and the old `GET`, replace with `groupBy`-driven `GET`)
- Modify: `app/api/admin/orders/orders.test.ts` (rewrite for the new contract)

**Interfaces:**
- Consumes: `weekRange` (existing, `lib/catalog.ts`).
- Produces: `type GroupBy = "supplier" | "date" | "flat"`; `interface OpenOrderLine { id, quantityOrdered, quantityReceived, createdAt, supplyOrder: { id, status, supplier: { id, name } }, product: { id, title, catalogNumber, label: { name }, productType: { name }, productArtists: {...} } }`; `getOpenOrderLines(groupBy: GroupBy): Promise<GroupedOrders>` where `GroupedOrders` is a discriminated union on `groupBy` (`"supplier"` → `{ groupBy, groups: SupplierGroup[] }`; `"date"` → `{ groupBy, groups: WeekGroup[] }`; `"flat"` → `{ groupBy, lines: OpenOrderLine[] }`). `GET /api/admin/orders?groupBy=...` wraps this directly. Consumed by Task 17's overview page.

- [ ] **Step 1: Write the failing tests**

```ts
// lib/order-overview.test.ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

vi.mock("@/lib/db", () => ({ db: { supplyOrderLine: { findMany: vi.fn() } } }));

import { db } from "@/lib/db";
import { getOpenOrderLines } from "@/lib/order-overview";

const findMany = (db.supplyOrderLine as unknown as { findMany: Mock }).findMany;

function makeLine(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "l1",
    quantityOrdered: 5,
    quantityReceived: 0,
    createdAt: new Date("2026-08-03T10:00:00Z"), // a Monday
    supplyOrder: { id: "o1", status: "PENDING", supplier: { id: "s1", name: "Beta" } },
    product: {
      id: "p1",
      title: "Torus",
      catalogNumber: "ZR-001",
      label: { name: "Zulema" },
      productType: { name: "LP" },
      productArtists: [{ position: 0, artist: { name: "Vril" } }],
    },
    ...overrides,
  };
}

beforeEach(() => vi.clearAllMocks());

describe("getOpenOrderLines", () => {
  it("queries only non-RECEIVED lines, newest first", async () => {
    findMany.mockResolvedValue([]);
    await getOpenOrderLines("flat");
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { supplyOrder: { status: { not: "RECEIVED" } } },
        orderBy: { createdAt: "desc" },
      }),
    );
  });

  it("flat: returns the lines as-is", async () => {
    const line = makeLine();
    findMany.mockResolvedValue([line]);
    const result = await getOpenOrderLines("flat");
    expect(result).toEqual({ groupBy: "flat", lines: [line] });
  });

  it("supplier: groups lines by supplier, sorted alphabetically", async () => {
    const betaLine = makeLine({ supplyOrder: { id: "o1", status: "PENDING", supplier: { id: "s1", name: "Beta" } } });
    const alphaLine = makeLine({ id: "l2", supplyOrder: { id: "o2", status: "SENT", supplier: { id: "s2", name: "Alpha" } } });
    findMany.mockResolvedValue([betaLine, alphaLine]);
    const result = await getOpenOrderLines("supplier");
    expect(result.groupBy).toBe("supplier");
    if (result.groupBy !== "supplier") return;
    expect(result.groups.map((g) => g.supplier.name)).toEqual(["Alpha", "Beta"]);
    expect(result.groups[1]).toEqual({
      supplier: { id: "s1", name: "Beta" },
      order: { id: "o1", status: "PENDING" },
      lines: [betaLine],
    });
  });

  it("date: groups lines by the shop week (Mon-Sun) they were added, newest week first", async () => {
    const thisWeek = makeLine({ createdAt: new Date("2026-08-03T10:00:00Z") }); // Monday
    const lastWeek = makeLine({ id: "l2", createdAt: new Date("2026-07-27T10:00:00Z") });
    findMany.mockResolvedValue([thisWeek, lastWeek]);
    const result = await getOpenOrderLines("date");
    expect(result.groupBy).toBe("date");
    if (result.groupBy !== "date") return;
    expect(result.groups).toHaveLength(2);
    expect(result.groups[0].lines).toEqual([thisWeek]);
    expect(result.groups[1].lines).toEqual([lastWeek]);
    expect(result.groups[0].weekStart.getTime()).toBeGreaterThan(result.groups[1].weekStart.getTime());
  });
});
```

- [ ] **Step 2: Run it, confirm it fails**

Run: `npx vitest run lib/order-overview.test.ts`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement**

```ts
// lib/order-overview.ts
import type { SupplyOrderStatus } from "@prisma/client";

import { db } from "@/lib/db";
import { weekRange } from "@/lib/catalog";

export type GroupBy = "supplier" | "date" | "flat";

export interface OpenOrderLine {
  id: string;
  quantityOrdered: number;
  quantityReceived: number;
  createdAt: Date;
  supplyOrder: {
    id: string;
    status: SupplyOrderStatus;
    supplier: { id: string; name: string };
  };
  product: {
    id: string;
    title: string;
    catalogNumber: string | null;
    label: { name: string };
    productType: { name: string };
    productArtists: { position: number; artist: { name: string } }[];
  };
}

export interface SupplierGroup {
  supplier: { id: string; name: string };
  order: { id: string; status: SupplyOrderStatus };
  lines: OpenOrderLine[];
}

export interface WeekGroup {
  weekStart: Date;
  lines: OpenOrderLine[];
}

export type GroupedOrders =
  | { groupBy: "supplier"; groups: SupplierGroup[] }
  | { groupBy: "date"; groups: WeekGroup[] }
  | { groupBy: "flat"; lines: OpenOrderLine[] };

// Every line whose parent order isn't yet fully received — the admin's
// "what's outstanding" view. Once an order is RECEIVED it drops out; its
// history lives in the monthly transactions ledger instead.
export async function getOpenOrderLines(groupBy: GroupBy): Promise<GroupedOrders> {
  const lines = (await db.supplyOrderLine.findMany({
    where: { supplyOrder: { status: { not: "RECEIVED" } } },
    orderBy: { createdAt: "desc" },
    include: {
      supplyOrder: { include: { supplier: true } },
      product: {
        include: {
          label: true,
          productType: true,
          productArtists: { include: { artist: true }, orderBy: { position: "asc" } },
        },
      },
    },
  })) as OpenOrderLine[];

  if (groupBy === "flat") {
    return { groupBy: "flat", lines };
  }

  if (groupBy === "supplier") {
    const bySupplier = new Map<string, SupplierGroup>();
    for (const line of lines) {
      const supplierId = line.supplyOrder.supplier.id;
      let group = bySupplier.get(supplierId);
      if (!group) {
        group = {
          supplier: line.supplyOrder.supplier,
          order: { id: line.supplyOrder.id, status: line.supplyOrder.status },
          lines: [],
        };
        bySupplier.set(supplierId, group);
      }
      group.lines.push(line);
    }
    const groups = [...bySupplier.values()].sort((a, b) =>
      a.supplier.name.localeCompare(b.supplier.name),
    );
    return { groupBy: "supplier", groups };
  }

  const byWeekStart = new Map<number, WeekGroup>();
  for (const line of lines) {
    const { start } = weekRange(0, line.createdAt);
    const key = start.getTime();
    let group = byWeekStart.get(key);
    if (!group) {
      group = { weekStart: start, lines: [] };
      byWeekStart.set(key, group);
    }
    group.lines.push(line);
  }
  const groups = [...byWeekStart.values()].sort(
    (a, b) => b.weekStart.getTime() - a.weekStart.getTime(),
  );
  return { groupBy: "date", groups };
}
```

- [ ] **Step 4: Run it, confirm it passes**

Run: `npx vitest run lib/order-overview.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing route test, replacing `orders.test.ts` entirely**

```ts
// app/api/admin/orders/orders.test.ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

vi.mock("@/lib/api-auth", () => ({ requireAdmin: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/order-overview", () => ({ getOpenOrderLines: vi.fn() }));

import { GET } from "@/app/api/admin/orders/route";
import { getOpenOrderLines } from "@/lib/order-overview";
import { requireAdmin } from "@/lib/api-auth";

const mockGetOpenOrderLines = vi.mocked(getOpenOrderLines);
const mockRequireAdmin = vi.mocked(requireAdmin);
const req = (qs = "") => new Request(`http://t/api/admin/orders${qs}`);

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAdmin.mockResolvedValue(null);
  mockGetOpenOrderLines.mockResolvedValue({ groupBy: "supplier", groups: [] });
});

describe("GET /api/admin/orders", () => {
  it("defaults to groupBy=supplier", async () => {
    await GET(req());
    expect(mockGetOpenOrderLines).toHaveBeenCalledWith("supplier");
  });

  it("passes through a valid groupBy value", async () => {
    await GET(req("?groupBy=date"));
    expect(mockGetOpenOrderLines).toHaveBeenCalledWith("date");
  });

  it("falls back to supplier for an invalid groupBy value", async () => {
    await GET(req("?groupBy=nonsense"));
    expect(mockGetOpenOrderLines).toHaveBeenCalledWith("supplier");
  });

  it("returns the result as JSON", async () => {
    mockGetOpenOrderLines.mockResolvedValue({ groupBy: "flat", lines: [] });
    const res = await GET(req("?groupBy=flat"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ groupBy: "flat", lines: [] });
  });
});
```

- [ ] **Step 6: Run it, confirm it fails**

Run: `npx vitest run app/api/admin/orders/orders.test.ts`
Expected: FAIL — `route.ts` still has the old `GET`/`POST`.

- [ ] **Step 7: Rewrite the route**

```ts
// app/api/admin/orders/route.ts
import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/api-auth";
import { getOpenOrderLines, type GroupBy } from "@/lib/order-overview";

const VALID_GROUP_BY = new Set(["supplier", "date", "flat"]);

export async function GET(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const raw = new URL(req.url).searchParams.get("groupBy") ?? "supplier";
  const groupBy = (VALID_GROUP_BY.has(raw) ? raw : "supplier") as GroupBy;
  const result = await getOpenOrderLines(groupBy);
  return NextResponse.json(result);
}
```

(`POST` — the old manual order-creation handler — is deleted along with this rewrite; it has no caller once Task 18 removes the `/new` page.)

- [ ] **Step 8: Run it, confirm it passes**

Run: `npx vitest run app/api/admin/orders/orders.test.ts`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add lib/order-overview.ts lib/order-overview.test.ts app/api/admin/orders/route.ts \
  app/api/admin/orders/orders.test.ts
git commit -m "feat: replace order list/create with groupBy-driven open-orders overview"
```

---

## Task 14: components/admin/AutoPrintToggle.tsx

**Files:**
- Create: `components/admin/AutoPrintToggle.tsx`
- Create: `components/admin/AutoPrintToggle.test.tsx`

**Interfaces:**
- Produces: `<AutoPrintToggle />` (no props) and the exported constant `AUTO_PRINT_STORAGE_KEY`. Consumed by Task 15's `OrderLineRow` (reads the flag) and Task 17's overview page (renders the checkbox).

- [ ] **Step 1: Write the failing tests**

```tsx
// components/admin/AutoPrintToggle.test.tsx
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { AutoPrintToggle, AUTO_PRINT_STORAGE_KEY } from "@/components/admin/AutoPrintToggle";

beforeEach(() => localStorage.clear());

describe("AutoPrintToggle", () => {
  it("starts unchecked when nothing is stored", () => {
    render(<AutoPrintToggle />);
    expect(screen.getByRole("checkbox", { name: /auto-print/i })).not.toBeChecked();
  });

  it("reflects a previously stored true value", async () => {
    localStorage.setItem(AUTO_PRINT_STORAGE_KEY, "true");
    render(<AutoPrintToggle />);
    expect(await screen.findByRole("checkbox", { name: /auto-print/i })).toBeChecked();
  });

  it("persists a change to localStorage", async () => {
    const user = userEvent.setup();
    render(<AutoPrintToggle />);
    await user.click(screen.getByRole("checkbox", { name: /auto-print/i }));
    expect(localStorage.getItem(AUTO_PRINT_STORAGE_KEY)).toBe("true");
  });
});
```

- [ ] **Step 2: Run it, confirm it fails**

Run: `npx vitest run components/admin/AutoPrintToggle.test.tsx`
Expected: FAIL — component doesn't exist.

- [ ] **Step 3: Implement**

```tsx
// components/admin/AutoPrintToggle.tsx
"use client";

import { useEffect, useState } from "react";

export const AUTO_PRINT_STORAGE_KEY = "antenne-tilburg:auto-print-on-receive";

// Per-browser preference, not per-account — deliberately localStorage, not a
// DB field. Read on mount rather than during render so server/client markup
// match on first paint.
export function AutoPrintToggle() {
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    setChecked(localStorage.getItem(AUTO_PRINT_STORAGE_KEY) === "true");
  }, []);

  function toggle(next: boolean) {
    setChecked(next);
    localStorage.setItem(AUTO_PRINT_STORAGE_KEY, String(next));
  }

  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" checked={checked} onChange={(e) => toggle(e.target.checked)} />
      Auto-print label on receipt
    </label>
  );
}
```

- [ ] **Step 4: Run it, confirm it passes**

Run: `npx vitest run components/admin/AutoPrintToggle.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/admin/AutoPrintToggle.tsx components/admin/AutoPrintToggle.test.tsx
git commit -m "feat: add AutoPrintToggle (localStorage-backed)"
```

---

## Task 15: components/admin/OrderLineRow.tsx + OrderLinesTable.tsx

**Files:**
- Create: `components/admin/OrderLineRow.tsx`
- Create: `components/admin/OrderLineRow.test.tsx`
- Create: `components/admin/OrderLinesTable.tsx`
- Create: `components/admin/OrderLinesTable.test.tsx`

**Interfaces:**
- Consumes: `PATCH /api/admin/orders/lines/[id]` (Task 10), `PATCH /api/admin/orders/lines/[id]/receive` (Task 11), `AUTO_PRINT_STORAGE_KEY` (Task 14).
- Produces: `interface OrderLineRowData { id, productId, quantityOrdered, quantityReceived, createdAt: string, title, catalogNumber: string | null, labelName, productTypeName, artistNames }`; `<OrderLineRow line={OrderLineRowData} />`; `<OrderLinesTable lines={OrderLineRowData[]} />` (renders the `<table>` header + one `OrderLineRow` per line — shared by Task 16's `SupplierOrderGroup` and Task 17's date/flat sections so the nine-column header isn't tripled). Task 17 also depends on a `toRowData(line: OpenOrderLine): OrderLineRowData` mapper it defines itself from Task 13's type.

- [ ] **Step 1: Write the failing tests for `OrderLineRow`**

```tsx
// components/admin/OrderLineRow.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { OrderLineRow, type OrderLineRowData } from "@/components/admin/OrderLineRow";
import { AUTO_PRINT_STORAGE_KEY } from "@/components/admin/AutoPrintToggle";

const LINE: OrderLineRowData = {
  id: "l1",
  productId: "p1",
  quantityOrdered: 5,
  quantityReceived: 0,
  createdAt: "2026-08-03T10:00:00.000Z",
  title: "Torus",
  catalogNumber: "ZR-001",
  labelName: "Zulema",
  productTypeName: "LP",
  artistNames: "Vril",
};

function renderRow(line: OrderLineRowData = LINE) {
  return render(
    <table>
      <tbody>
        <OrderLineRow line={line} />
      </tbody>
    </table>,
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe("OrderLineRow", () => {
  it("shows pending status and a 'Mark received' action for an unreceived line", () => {
    renderRow();
    expect(screen.getByText(/pending/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /mark received/i })).toBeInTheDocument();
  });

  it("shows partial status for a partly-received line", () => {
    renderRow({ ...LINE, quantityReceived: 2 });
    expect(screen.getByText(/partial/i)).toBeInTheDocument();
  });

  it("saves an edited quantity on blur", async () => {
    const user = userEvent.setup();
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ id: "l1", quantityOrdered: 8 }),
    } as Response);
    renderRow();
    const input = screen.getByLabelText(/quantity ordered for torus/i);
    await user.clear(input);
    await user.type(input, "8");
    await user.tab();
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/admin/orders/lines/l1",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ quantityOrdered: 8 }),
        }),
      );
    });
  });

  it("marking received defaults the qty input to the remaining amount and confirms", async () => {
    const user = userEvent.setup();
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({}),
    } as Response);
    renderRow({ ...LINE, quantityOrdered: 5, quantityReceived: 2 });

    await user.click(screen.getByRole("button", { name: /mark received/i }));
    expect(screen.getByLabelText(/quantity received for torus/i)).toHaveValue(3);

    await user.click(screen.getByRole("button", { name: /confirm/i }));
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/admin/orders/lines/l1/receive",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ quantityReceived: 3 }),
        }),
      );
    });
  });

  it("opens the label print URL after a successful receive when auto-print is on", async () => {
    localStorage.setItem(AUTO_PRINT_STORAGE_KEY, "true");
    const user = userEvent.setup();
    vi.spyOn(global, "fetch").mockResolvedValue({ ok: true, json: async () => ({}) } as Response);
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    renderRow();

    await user.click(screen.getByRole("button", { name: /mark received/i }));
    await user.click(screen.getByRole("button", { name: /confirm/i }));

    await waitFor(() => {
      expect(openSpy).toHaveBeenCalledWith("/api/admin/label/p1", "_blank", "noopener,noreferrer");
    });
  });

  it("does not open a print URL when auto-print is off", async () => {
    const user = userEvent.setup();
    vi.spyOn(global, "fetch").mockResolvedValue({ ok: true, json: async () => ({}) } as Response);
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    renderRow();

    await user.click(screen.getByRole("button", { name: /mark received/i }));
    await user.click(screen.getByRole("button", { name: /confirm/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/admin/orders/lines/l1/receive",
        expect.anything(),
      );
    });
    expect(openSpy).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run it, confirm it fails**

Run: `npx vitest run components/admin/OrderLineRow.test.tsx`
Expected: FAIL — component doesn't exist.

- [ ] **Step 3: Implement `OrderLineRow`**

```tsx
// components/admin/OrderLineRow.tsx
"use client";

import { useState } from "react";

import { apiSend } from "@/lib/api-client";
import { useAsyncAction } from "@/lib/use-async-action";
import { AUTO_PRINT_STORAGE_KEY } from "@/components/admin/AutoPrintToggle";

export interface OrderLineRowData {
  id: string;
  productId: string;
  quantityOrdered: number;
  quantityReceived: number;
  createdAt: string;
  title: string;
  catalogNumber: string | null;
  labelName: string;
  productTypeName: string;
  artistNames: string;
}

function lineStatus(line: {
  quantityOrdered: number;
  quantityReceived: number;
}): "pending" | "partial" | "received" {
  if (line.quantityReceived >= line.quantityOrdered) return "received";
  if (line.quantityReceived > 0) return "partial";
  return "pending";
}

export function OrderLineRow({ line }: { line: OrderLineRowData }) {
  const [quantityOrdered, setQuantityOrdered] = useState(line.quantityOrdered);
  const [quantityReceived, setQuantityReceived] = useState(line.quantityReceived);
  const [qtyDraft, setQtyDraft] = useState(String(line.quantityOrdered));
  const [receiving, setReceiving] = useState(false);
  const [receiveDraft, setReceiveDraft] = useState(
    String(line.quantityOrdered - line.quantityReceived),
  );
  const qtyAction = useAsyncAction();
  const receiveAction = useAsyncAction();

  function saveQuantity() {
    const next = Number.parseInt(qtyDraft, 10);
    if (!Number.isInteger(next) || next < quantityReceived) {
      qtyAction.setError(`Quantity must be a whole number of at least ${quantityReceived}`);
      return;
    }
    if (next === quantityOrdered) return;
    qtyAction.run(async () => {
      await apiSend(`/api/admin/orders/lines/${line.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ quantityOrdered: next }),
      });
      setQuantityOrdered(next);
    });
  }

  function confirmReceive() {
    const amount = Number.parseInt(receiveDraft, 10);
    if (!Number.isInteger(amount) || amount <= 0) {
      receiveAction.setError("Enter a whole number greater than zero");
      return;
    }
    receiveAction.run(async () => {
      await apiSend(`/api/admin/orders/lines/${line.id}/receive`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ quantityReceived: amount }),
      });
      setQuantityReceived((prev) => prev + amount);
      setReceiving(false);
      if (localStorage.getItem(AUTO_PRINT_STORAGE_KEY) === "true") {
        window.open(`/api/admin/label/${line.productId}`, "_blank", "noopener,noreferrer");
      }
    });
  }

  const status = lineStatus({ quantityOrdered, quantityReceived });
  const remaining = quantityOrdered - quantityReceived;

  return (
    <tr className="border-b border-admin-hairline text-sm">
      <td className="px-3 py-2">{line.artistNames}</td>
      <td className="px-3 py-2">{line.title}</td>
      <td className="px-3 py-2 text-admin-ink-muted">{line.catalogNumber ?? "—"}</td>
      <td className="px-3 py-2 text-admin-ink-muted">{line.labelName}</td>
      <td className="px-3 py-2 text-admin-ink-muted">{line.productTypeName}</td>
      <td className="px-3 py-2">
        <input
          type="number"
          min={quantityReceived}
          value={qtyDraft}
          onChange={(e) => setQtyDraft(e.target.value)}
          onBlur={saveQuantity}
          aria-label={`Quantity ordered for ${line.title}`}
          disabled={qtyAction.pending || status === "received"}
          className="w-16 rounded border border-admin-hairline px-2 py-1 text-sm tabular-nums"
        />
      </td>
      <td className="px-3 py-2 text-admin-ink-muted">
        {new Date(line.createdAt).toLocaleDateString()}
      </td>
      <td className="px-3 py-2">
        <span
          className={`rounded px-1.5 py-0.5 text-xs ${
            status === "received"
              ? "bg-green-500/15 text-green-400"
              : status === "partial"
                ? "bg-amber-500/15 text-amber-400"
                : "bg-admin-raised text-admin-ink-muted"
          }`}
        >
          {status}
        </span>
      </td>
      <td className="px-3 py-2">
        {status === "received" ? null : receiving ? (
          <span className="inline-flex items-center gap-1">
            <input
              type="number"
              min={1}
              max={remaining}
              value={receiveDraft}
              onChange={(e) => setReceiveDraft(e.target.value)}
              aria-label={`Quantity received for ${line.title}`}
              className="w-14 rounded border border-admin-hairline px-2 py-1 text-sm tabular-nums"
            />
            <button
              type="button"
              onClick={confirmReceive}
              disabled={receiveAction.pending}
              className="rounded border border-admin-hairline px-2 py-1 text-xs hover:bg-admin-raised"
            >
              {receiveAction.pending ? "…" : "Confirm"}
            </button>
            <button
              type="button"
              onClick={() => setReceiving(false)}
              className="text-xs text-admin-ink-muted hover:underline"
            >
              Cancel
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => {
              setReceiveDraft(String(remaining));
              setReceiving(true);
            }}
            className="rounded border border-admin-hairline px-2 py-1 text-xs hover:bg-admin-raised"
          >
            Mark received
          </button>
        )}
        {(qtyAction.error || receiveAction.error) && (
          <p role="alert" className="mt-1 text-xs text-red-400">
            {qtyAction.error ?? receiveAction.error}
          </p>
        )}
      </td>
    </tr>
  );
}
```

- [ ] **Step 4: Run it, confirm it passes**

Run: `npx vitest run components/admin/OrderLineRow.test.tsx`
Expected: PASS.

- [ ] **Step 5: Write the failing test for `OrderLinesTable`**

```tsx
// components/admin/OrderLinesTable.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { OrderLinesTable } from "@/components/admin/OrderLinesTable";
import type { OrderLineRowData } from "@/components/admin/OrderLineRow";

const LINE: OrderLineRowData = {
  id: "l1",
  productId: "p1",
  quantityOrdered: 5,
  quantityReceived: 0,
  createdAt: "2026-08-03T10:00:00.000Z",
  title: "Torus",
  catalogNumber: "ZR-001",
  labelName: "Zulema",
  productTypeName: "LP",
  artistNames: "Vril",
};

describe("OrderLinesTable", () => {
  it("renders a header and one row per line", () => {
    render(<OrderLinesTable lines={[LINE]} />);
    expect(screen.getByRole("columnheader", { name: /artist/i })).toBeInTheDocument();
    expect(screen.getByText("Torus")).toBeInTheDocument();
  });
});
```

- [ ] **Step 6: Run it, confirm it fails**

Run: `npx vitest run components/admin/OrderLinesTable.test.tsx`
Expected: FAIL — component doesn't exist.

- [ ] **Step 7: Implement `OrderLinesTable`**

```tsx
// components/admin/OrderLinesTable.tsx
import { OrderLineRow, type OrderLineRowData } from "@/components/admin/OrderLineRow";

// Shared nine-column header + body — used by SupplierOrderGroup and by the
// date/flat groupings on the orders overview page, so the header markup
// isn't tripled across three near-identical tables.
export function OrderLinesTable({ lines }: { lines: OrderLineRowData[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead className="border-y border-admin-hairline bg-admin-bg text-xs text-admin-ink-muted">
          <tr>
            <th className="px-3 py-2 font-medium">Artist</th>
            <th className="px-3 py-2 font-medium">Title</th>
            <th className="px-3 py-2 font-medium">Labelcode</th>
            <th className="px-3 py-2 font-medium">Label</th>
            <th className="px-3 py-2 font-medium">Format</th>
            <th className="px-3 py-2 font-medium">Qty</th>
            <th className="px-3 py-2 font-medium">Added</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 font-medium">Receive</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => (
            <OrderLineRow key={line.id} line={line} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 8: Run it, confirm it passes**

Run: `npx vitest run components/admin/OrderLinesTable.test.tsx`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add components/admin/OrderLineRow.tsx components/admin/OrderLineRow.test.tsx \
  components/admin/OrderLinesTable.tsx components/admin/OrderLinesTable.test.tsx
git commit -m "feat: add OrderLineRow (inline edit/receive) and shared OrderLinesTable"
```

---

## Task 16: components/admin/SupplierOrderGroup.tsx

**Files:**
- Create: `components/admin/SupplierOrderGroup.tsx`
- Create: `components/admin/SupplierOrderGroup.test.tsx`

**Interfaces:**
- Consumes: `PATCH /api/admin/orders/[id]` (Task 12), `<OrderLinesTable>` (Task 15).
- Produces: `<SupplierOrderGroup supplierName orderId orderStatus lines={OrderLineRowData[]} />`. Consumed by Task 17's overview page (supplier grouping).

- [ ] **Step 1: Write the failing tests**

```tsx
// components/admin/SupplierOrderGroup.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { SupplierOrderGroup } from "@/components/admin/SupplierOrderGroup";
import type { OrderLineRowData } from "@/components/admin/OrderLineRow";

const LINE: OrderLineRowData = {
  id: "l1",
  productId: "p1",
  quantityOrdered: 5,
  quantityReceived: 0,
  createdAt: "2026-08-03T10:00:00.000Z",
  title: "Torus",
  catalogNumber: "ZR-001",
  labelName: "Zulema",
  productTypeName: "LP",
  artistNames: "Vril",
};

beforeEach(() => vi.restoreAllMocks());

describe("SupplierOrderGroup", () => {
  it("shows the supplier name and an enabled 'Mark all as sent' button for a PENDING order", () => {
    render(
      <SupplierOrderGroup supplierName="Beta Distro" orderId="o1" orderStatus="PENDING" lines={[LINE]} />,
    );
    expect(screen.getByText("Beta Distro")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /mark all as sent/i })).not.toBeDisabled();
  });

  it("disables the export PDF button with a 'Coming soon' title", () => {
    render(
      <SupplierOrderGroup supplierName="Beta Distro" orderId="o1" orderStatus="PENDING" lines={[LINE]} />,
    );
    const exportButton = screen.getByRole("button", { name: /export pdf/i });
    expect(exportButton).toBeDisabled();
    expect(exportButton).toHaveAttribute("title", "Coming soon");
  });

  it("marks the order sent on click and disables the button", async () => {
    const user = userEvent.setup();
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ id: "o1", status: "SENT" }),
    } as Response);
    render(
      <SupplierOrderGroup supplierName="Beta Distro" orderId="o1" orderStatus="PENDING" lines={[LINE]} />,
    );

    await user.click(screen.getByRole("button", { name: /mark all as sent/i }));

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/admin/orders/o1",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ status: "SENT" }),
      }),
    );
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /^sent$/i })).toBeDisabled();
    });
  });

  it("starts already disabled when the order is already SENT", () => {
    render(
      <SupplierOrderGroup supplierName="Beta Distro" orderId="o1" orderStatus="SENT" lines={[LINE]} />,
    );
    expect(screen.getByRole("button", { name: /^sent$/i })).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run it, confirm it fails**

Run: `npx vitest run components/admin/SupplierOrderGroup.test.tsx`
Expected: FAIL — component doesn't exist.

- [ ] **Step 3: Implement**

```tsx
// components/admin/SupplierOrderGroup.tsx
"use client";

import { useState } from "react";

import { apiSend } from "@/lib/api-client";
import { useAsyncAction } from "@/lib/use-async-action";
import { OrderLinesTable } from "@/components/admin/OrderLinesTable";
import type { OrderLineRowData } from "@/components/admin/OrderLineRow";

export function SupplierOrderGroup({
  supplierName,
  orderId,
  orderStatus,
  lines,
}: {
  supplierName: string;
  orderId: string;
  orderStatus: "PENDING" | "SENT" | "PARTIAL" | "RECEIVED";
  lines: OrderLineRowData[];
}) {
  const [status, setStatus] = useState(orderStatus);
  const { pending, error, run } = useAsyncAction();

  function markSent() {
    run(async () => {
      await apiSend(`/api/admin/orders/${orderId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "SENT" }),
      });
      setStatus("SENT");
    });
  }

  return (
    <details className="rounded border border-admin-hairline bg-admin-surface" open>
      <summary className="flex cursor-pointer items-center justify-between gap-2 px-4 py-3">
        <span className="font-semibold">{supplierName}</span>
        <span className="flex items-center gap-2 text-sm" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={markSent}
            disabled={pending || status === "SENT"}
            className="rounded border border-admin-hairline px-2 py-1 text-xs hover:bg-admin-raised disabled:opacity-40"
          >
            {status === "SENT" ? "Sent" : pending ? "…" : "Mark all as sent"}
          </button>
          <button
            type="button"
            disabled
            title="Coming soon"
            className="rounded border border-admin-hairline px-2 py-1 text-xs opacity-40"
          >
            Export PDF
          </button>
        </span>
      </summary>
      {error && (
        <p role="alert" className="px-4 pb-2 text-xs text-red-400">
          {error}
        </p>
      )}
      <OrderLinesTable lines={lines} />
    </details>
  );
}
```

- [ ] **Step 4: Run it, confirm it passes**

Run: `npx vitest run components/admin/SupplierOrderGroup.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/admin/SupplierOrderGroup.tsx components/admin/SupplierOrderGroup.test.tsx
git commit -m "feat: add SupplierOrderGroup (collapsible, mark-all-as-sent)"
```

---

## Task 17: Rewrite app/admin/catalog/orders/page.tsx (grouped overview)

**Files:**
- Modify: `app/admin/catalog/orders/page.tsx` (full rewrite)
- Modify: `app/admin/catalog/orders/orders-page.test.tsx` (full rewrite)

**Interfaces:**
- Consumes: `getOpenOrderLines`/`OpenOrderLine` (Task 13), `joinArtistNames` (existing, `lib/catalog.ts`), `<AutoPrintToggle>` (Task 14), `<SupplierOrderGroup>` (Task 16), `<OrderLinesTable>`/`OrderLineRowData` (Task 15).

- [ ] **Step 1: Write the failing tests, replacing `orders-page.test.tsx` entirely**

Read the existing file first for its render/mock conventions, then replace its contents with:

```tsx
// app/admin/catalog/orders/orders-page.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("@/lib/order-overview", () => ({ getOpenOrderLines: vi.fn() }));

import OrdersOverviewPage from "@/app/admin/catalog/orders/page";
import { getOpenOrderLines } from "@/lib/order-overview";

const LINE = {
  id: "l1",
  quantityOrdered: 5,
  quantityReceived: 0,
  createdAt: new Date("2026-08-03T10:00:00Z"),
  supplyOrder: { id: "o1", status: "PENDING" as const, supplier: { id: "s1", name: "Beta Distro" } },
  product: {
    id: "p1",
    title: "Torus",
    catalogNumber: "ZR-001",
    label: { name: "Zulema" },
    productType: { name: "LP" },
    productArtists: [{ position: 0, artist: { name: "Vril" } }],
  },
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("/admin/catalog/orders", () => {
  it("defaults to grouping by supplier and shows the supplier's line", async () => {
    vi.mocked(getOpenOrderLines).mockResolvedValue({
      groupBy: "supplier",
      groups: [{ supplier: { id: "s1", name: "Beta Distro" }, order: { id: "o1", status: "PENDING" }, lines: [LINE] }],
    });
    const ui = await OrdersOverviewPage({ searchParams: Promise.resolve({}) });
    render(ui);
    expect(getOpenOrderLines).toHaveBeenCalledWith("supplier");
    expect(screen.getByText("Beta Distro")).toBeInTheDocument();
    expect(screen.getByText("Torus")).toBeInTheDocument();
  });

  it("passes ?group=date through to getOpenOrderLines and renders week sections", async () => {
    const weekStart = new Date("2026-08-03T00:00:00Z");
    vi.mocked(getOpenOrderLines).mockResolvedValue({
      groupBy: "date",
      groups: [{ weekStart, lines: [LINE] }],
    });
    const ui = await OrdersOverviewPage({ searchParams: Promise.resolve({ group: "date" }) });
    render(ui);
    expect(getOpenOrderLines).toHaveBeenCalledWith("date");
    expect(screen.getByText(/week of/i)).toBeInTheDocument();
    expect(screen.getByText("Torus")).toBeInTheDocument();
  });

  it("passes ?group=flat through and renders a flat list", async () => {
    vi.mocked(getOpenOrderLines).mockResolvedValue({ groupBy: "flat", lines: [LINE] });
    const ui = await OrdersOverviewPage({ searchParams: Promise.resolve({ group: "flat" }) });
    render(ui);
    expect(getOpenOrderLines).toHaveBeenCalledWith("flat");
    expect(screen.getByText("Torus")).toBeInTheDocument();
  });

  it("shows an empty state when there are no open orders", async () => {
    vi.mocked(getOpenOrderLines).mockResolvedValue({ groupBy: "supplier", groups: [] });
    const ui = await OrdersOverviewPage({ searchParams: Promise.resolve({}) });
    render(ui);
    expect(screen.getByText(/no open orders/i)).toBeInTheDocument();
  });

  it("renders the auto-print checkbox", async () => {
    vi.mocked(getOpenOrderLines).mockResolvedValue({ groupBy: "supplier", groups: [] });
    const ui = await OrdersOverviewPage({ searchParams: Promise.resolve({}) });
    render(ui);
    expect(screen.getByRole("checkbox", { name: /auto-print/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it, confirm it fails**

Run: `npx vitest run app/admin/catalog/orders/orders-page.test.tsx`
Expected: FAIL — page still renders the old table.

- [ ] **Step 3: Implement the page**

```tsx
// app/admin/catalog/orders/page.tsx
import Link from "next/link";

import { getOpenOrderLines, type GroupBy, type OpenOrderLine } from "@/lib/order-overview";
import { joinArtistNames } from "@/lib/catalog";
import { AutoPrintToggle } from "@/components/admin/AutoPrintToggle";
import { SupplierOrderGroup } from "@/components/admin/SupplierOrderGroup";
import { OrderLinesTable } from "@/components/admin/OrderLinesTable";
import type { OrderLineRowData } from "@/components/admin/OrderLineRow";

export const dynamic = "force-dynamic";

const GROUP_TABS: { value: GroupBy; label: string }[] = [
  { value: "supplier", label: "By supplier" },
  { value: "date", label: "By date ordered" },
  { value: "flat", label: "Flat list" },
];

function toRowData(line: OpenOrderLine): OrderLineRowData {
  return {
    id: line.id,
    productId: line.product.id,
    quantityOrdered: line.quantityOrdered,
    quantityReceived: line.quantityReceived,
    createdAt: line.createdAt.toISOString(),
    title: line.product.title,
    catalogNumber: line.product.catalogNumber,
    labelName: line.product.label.name,
    productTypeName: line.product.productType.name,
    artistNames: joinArtistNames(line.product.productArtists),
  };
}

export default async function OrdersOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ group?: string }>;
}) {
  const sp = await searchParams;
  const groupBy: GroupBy = sp.group === "date" || sp.group === "flat" ? sp.group : "supplier";
  const result = await getOpenOrderLines(groupBy);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Orders</h1>
          <p className="text-sm text-admin-ink-muted">
            Products ordered from suppliers, awaiting delivery.
          </p>
        </div>
        <AutoPrintToggle />
      </div>

      <nav className="flex gap-4 border-b border-admin-hairline text-sm">
        {GROUP_TABS.map((tab) => (
          <Link
            key={tab.value}
            href={tab.value === "supplier" ? "/admin/catalog/orders" : `/admin/catalog/orders?group=${tab.value}`}
            aria-current={groupBy === tab.value ? "page" : undefined}
            className={`-mb-px border-b-2 pb-2 ${
              groupBy === tab.value
                ? "border-admin-ink font-medium"
                : "border-transparent text-admin-ink-muted hover:text-admin-ink"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      {result.groupBy === "supplier" &&
        (result.groups.length === 0 ? (
          <p className="rounded border border-dashed border-admin-hairline p-8 text-center text-admin-ink-muted">
            No open orders. Use &quot;Order&quot; on a catalog or transactions row to start one.
          </p>
        ) : (
          <div className="space-y-4">
            {result.groups.map((group) => (
              <SupplierOrderGroup
                key={group.supplier.id}
                supplierName={group.supplier.name}
                orderId={group.order.id}
                orderStatus={group.order.status}
                lines={group.lines.map(toRowData)}
              />
            ))}
          </div>
        ))}

      {result.groupBy === "date" &&
        (result.groups.length === 0 ? (
          <p className="rounded border border-dashed border-admin-hairline p-8 text-center text-admin-ink-muted">
            No open orders yet.
          </p>
        ) : (
          <div className="space-y-4">
            {result.groups.map((group) => (
              <section
                key={group.weekStart.toISOString()}
                className="rounded border border-admin-hairline bg-admin-surface"
              >
                <h2 className="border-b border-admin-hairline px-4 py-3 font-semibold">
                  Week of {group.weekStart.toLocaleDateString()}
                </h2>
                <OrderLinesTable lines={group.lines.map(toRowData)} />
              </section>
            ))}
          </div>
        ))}

      {result.groupBy === "flat" &&
        (result.lines.length === 0 ? (
          <p className="rounded border border-dashed border-admin-hairline p-8 text-center text-admin-ink-muted">
            No open orders yet.
          </p>
        ) : (
          <div className="rounded border border-admin-hairline bg-admin-surface">
            <OrderLinesTable lines={result.lines.map(toRowData)} />
          </div>
        ))}
    </div>
  );
}
```

- [ ] **Step 4: Run it, confirm it passes**

Run: `npx vitest run app/admin/catalog/orders/orders-page.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/admin/catalog/orders/page.tsx app/admin/catalog/orders/orders-page.test.tsx
git commit -m "feat: rewrite orders page as a grouped, inline-editable overview"
```

---

## Task 18: Remove the old manual order pages, forms, and their tests

**Files:**
- Delete: `app/admin/catalog/orders/new/page.tsx`
- Delete: `app/admin/catalog/orders/[id]/edit/page.tsx`
- Delete: `app/admin/catalog/orders/[id]/page.tsx`
- Delete: `app/admin/catalog/orders/[id]/order-detail-page.test.tsx`
- Delete: `components/admin/OrderForm.tsx`
- Delete: `components/admin/OrderForm.test.tsx`
- Delete: `components/admin/ReceiveOrderForm.tsx`
- Delete: `components/admin/ReceiveOrderForm.test.tsx` (check it exists first: `find components/admin -iname "ReceiveOrderForm*"`)
- Delete: `lib/supply-order-input.ts`
- Delete: `lib/supply-order-input.test.ts`
- Delete: `lib/supply-order-receive-input.ts`
- Delete: `lib/supply-order-receive-input.test.ts`

**Interfaces:**
- None produced — this is pure removal of code superseded by Tasks 6–17. `lib/supply-order-input.ts`/`lib/supply-order-receive-input.ts` are safe to delete because their only callers were the routes rewritten in Tasks 12–13 (`parseSupplyOrderInput` was used by the old `POST`/`PATCH` line-replacement logic; `parseReceiveInput` was used by the deleted whole-order receive route).

- [ ] **Step 1: Confirm nothing outside this list still imports the files being deleted**

Run: `grep -rln "OrderForm\|ReceiveOrderForm\|supply-order-input\|supply-order-receive-input" app components lib --include="*.ts" --include="*.tsx"`
Expected: only the files listed above (plus the now-rewritten `app/api/admin/orders/[id]/route.ts` and `app/api/admin/orders/route.ts`, which no longer import them after Tasks 12–13 — if either still shows up here, stop and fix that route first, don't delete out from under a live import).

- [ ] **Step 2: Delete the files**

```bash
git rm app/admin/catalog/orders/new/page.tsx \
  app/admin/catalog/orders/\[id\]/edit/page.tsx \
  app/admin/catalog/orders/\[id\]/page.tsx \
  app/admin/catalog/orders/\[id\]/order-detail-page.test.tsx \
  components/admin/OrderForm.tsx components/admin/OrderForm.test.tsx \
  lib/supply-order-input.ts lib/supply-order-input.test.ts \
  lib/supply-order-receive-input.ts lib/supply-order-receive-input.test.ts

# Only if it exists (some repos keep receive-form tests colocated differently — verify with the find command from Step 1's grep or:
find components/admin -iname "ReceiveOrderForm*"
git rm components/admin/ReceiveOrderForm.tsx components/admin/ReceiveOrderForm.test.tsx
```

- [ ] **Step 3: Remove the now-empty `[id]` directory if `git rm` left it empty**

`app/admin/catalog/orders/[id]/` had only the detail page and its test — after deletion the directory should be empty and git will drop it automatically (git doesn't track empty directories). Run `find app/admin/catalog/orders -type d` to confirm no stray empty directory remains tracked.

- [ ] **Step 4: Run typecheck and the full orders-related test suite**

Run: `npx tsc --noEmit`
Expected: no errors — confirms nothing still references the deleted modules.

Run: `npx vitest run app/admin/catalog/orders app/api/admin/orders components/admin`
Expected: PASS (no leftover references, no orphaned test files trying to import deleted modules).

- [ ] **Step 5: Commit**

```bash
git commit -m "chore: remove manual order create/edit/detail pages, superseded by quick-add + overview"
```

---

## Task 19: shopMonthRange/shopMonthISO/shiftMonth + lib/transactions-overview.ts + GET /api/admin/transactions

**Files:**
- Modify: `lib/catalog.ts` (add three helpers alongside `weekRange`/`shopDayRange`)
- Modify: `lib/catalog.test.ts`
- Create: `lib/transactions-overview.ts`
- Create: `lib/transactions-overview.test.ts`
- Create: `app/api/admin/transactions/route.ts`
- Create: `app/api/admin/transactions/route.test.ts`

**Interfaces:**
- Produces: `shopMonthRange(month: string): { start: Date; end: Date } | null` (null on malformed `YYYY-MM`, for the API route's untrusted query param); `shopMonthISO(date: Date): string` (current month in shop tz, `YYYY-MM`); `shiftMonth(month: string, delta: number): string` (assumes an already-valid month, for page nav — no null case, mirrors `weekRange`'s unguarded style). `getMonthTransactions(month: string): Promise<MonthTransaction[]>` where `MonthTransaction` includes `product` with `label`/`productArtists`/`supplierId`. `GET /api/admin/transactions?month=YYYY-MM`. Consumed by Task 20's transactions page.

- [ ] **Step 1: Write the failing tests for the three `lib/catalog.ts` helpers**

Read `lib/catalog.test.ts`'s existing `weekRange`/`shopDayRange` tests first to match style (in particular how they fix "now"/assert exact UTC instants), then add:

```ts
describe("shopMonthRange", () => {
  it("returns the shop-local midnight boundaries of the given month", () => {
    const range = shopMonthRange("2026-08");
    expect(range).not.toBeNull();
    // Aug 1 2026 00:00 Europe/Amsterdam (CEST, UTC+2) = 2026-07-31T22:00:00Z
    expect(range?.start.toISOString()).toBe("2026-07-31T22:00:00.000Z");
    // Sep 1 2026 00:00 CEST = 2026-08-31T22:00:00Z
    expect(range?.end.toISOString()).toBe("2026-08-31T22:00:00.000Z");
  });

  it("rolls over into January of the next year", () => {
    const range = shopMonthRange("2026-12");
    expect(range).not.toBeNull();
    expect(range?.end.toISOString()).toBe("2026-12-31T23:00:00.000Z"); // Jan 1 2027 CET (UTC+1)
  });

  it("returns null for a malformed month", () => {
    expect(shopMonthRange("2026-8")).toBeNull();
    expect(shopMonthRange("not-a-month")).toBeNull();
    expect(shopMonthRange("2026-13")).toBeNull();
  });
});

describe("shopMonthISO", () => {
  it("formats a date as its shop-local YYYY-MM", () => {
    expect(shopMonthISO(new Date("2026-08-03T10:00:00Z"))).toBe("2026-08");
  });
});

describe("shiftMonth", () => {
  it("moves forward and backward within a year", () => {
    expect(shiftMonth("2026-08", 1)).toBe("2026-09");
    expect(shiftMonth("2026-08", -1)).toBe("2026-07");
  });

  it("rolls over a year boundary in both directions", () => {
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
  });
});
```

- [ ] **Step 2: Run it, confirm it fails**

Run: `npx vitest run lib/catalog.test.ts`
Expected: FAIL — the three functions don't exist. (If the exact UTC instants in Step 1 don't match once you run the real `shopMidnightUTC` for those dates, trust the failure output over the numbers written here — DST transition math is what `shopMidnightUTC` already handles correctly elsewhere in this file; adjust the expected ISO strings to whatever it actually produces for these calendar dates, not the reverse.)

- [ ] **Step 3: Implement**

Add to `lib/catalog.ts`, near `shopDayRange`:

```ts
const ISO_MONTH = /^(\d{4})-(\d{2})$/;

// [start, end) of the given shop-local calendar month, as UTC instants.
// Returns null on malformed input (untrusted — comes from a URL query param).
export function shopMonthRange(month: string): { start: Date; end: Date } | null {
  const m = ISO_MONTH.exec(month);
  if (!m) return null;
  const year = Number(m[1]);
  const mo = Number(m[2]);
  if (mo < 1 || mo > 12) return null;
  const start = shopMidnightUTC(year, mo, 1);
  const next = mo === 12 ? { y: year + 1, m: 1 } : { y: year, m: mo + 1 };
  const end = shopMidnightUTC(next.y, next.m, 1);
  return { start, end };
}

// An instant's shop-local calendar month, as YYYY-MM.
export function shopMonthISO(date: Date): string {
  return shopDateISO(date).slice(0, 7);
}

// month +/- delta whole months, wrapping across year boundaries. Assumes an
// already-valid "YYYY-MM" (page nav only — the untrusted-input path is
// shopMonthRange above).
export function shiftMonth(month: string, delta: number): string {
  const [year, mo] = month.split("-").map(Number);
  const total = year * 12 + (mo - 1) + delta;
  const newYear = Math.floor(total / 12);
  const newMonth = (total % 12) + 1;
  return `${newYear}-${String(newMonth).padStart(2, "0")}`;
}
```

- [ ] **Step 4: Run it, confirm it passes**

Run: `npx vitest run lib/catalog.test.ts`
Expected: PASS, including every pre-existing test in the file.

- [ ] **Step 5: Write the failing tests for `getMonthTransactions`**

```ts
// lib/transactions-overview.test.ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

vi.mock("@/lib/db", () => ({ db: { stockTransaction: { findMany: vi.fn() } } }));

import { db } from "@/lib/db";
import { getMonthTransactions } from "@/lib/transactions-overview";

const findMany = (db.stockTransaction as unknown as { findMany: Mock }).findMany;

beforeEach(() => vi.clearAllMocks());

describe("getMonthTransactions", () => {
  it("returns an empty array for a malformed month without querying", async () => {
    const result = await getMonthTransactions("not-a-month");
    expect(result).toEqual([]);
    expect(findMany).not.toHaveBeenCalled();
  });

  it("queries the month's date range, newest first, with product relations", async () => {
    findMany.mockResolvedValue([]);
    await getMonthTransactions("2026-08");
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { createdAt: { gte: expect.any(Date), lt: expect.any(Date) } },
        orderBy: { createdAt: "desc" },
        include: expect.objectContaining({
          product: expect.objectContaining({
            include: expect.objectContaining({ label: true }),
          }),
        }),
      }),
    );
  });
});
```

- [ ] **Step 6: Run it, confirm it fails**

Run: `npx vitest run lib/transactions-overview.test.ts`
Expected: FAIL — module doesn't exist.

- [ ] **Step 7: Implement**

```ts
// lib/transactions-overview.ts
import { db } from "@/lib/db";
import { shopMonthRange } from "@/lib/catalog";

export interface MonthTransaction {
  id: string;
  type: "IN" | "OUT" | "ADJUSTMENT";
  quantity: number;
  createdAt: Date;
  product: {
    id: string;
    title: string;
    catalogNumber: string | null;
    supplierId: string | null;
    label: { name: string };
    productArtists: { position: number; artist: { name: string } }[];
  };
}

// No running balance here — unlike lib/stock-history.ts's per-product view,
// a cross-product balance is meaningless. This is a raw chronological ledger.
export async function getMonthTransactions(month: string): Promise<MonthTransaction[]> {
  const range = shopMonthRange(month);
  if (!range) return [];
  return db.stockTransaction.findMany({
    where: { createdAt: { gte: range.start, lt: range.end } },
    orderBy: { createdAt: "desc" },
    include: {
      product: {
        include: {
          label: true,
          productArtists: { include: { artist: true }, orderBy: { position: "asc" } },
        },
      },
    },
  });
}
```

- [ ] **Step 8: Run it, confirm it passes**

Run: `npx vitest run lib/transactions-overview.test.ts`
Expected: PASS.

- [ ] **Step 9: Write the failing route test**

```ts
// app/api/admin/transactions/route.test.ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api-auth", () => ({ requireAdmin: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/transactions-overview", () => ({ getMonthTransactions: vi.fn() }));

import { GET } from "@/app/api/admin/transactions/route";
import { getMonthTransactions } from "@/lib/transactions-overview";
import { requireAdmin } from "@/lib/api-auth";

const mockGet = vi.mocked(getMonthTransactions);
const mockRequireAdmin = vi.mocked(requireAdmin);
const req = (qs = "") => new Request(`http://t/api/admin/transactions${qs}`);

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAdmin.mockResolvedValue(null);
  mockGet.mockResolvedValue([]);
});

describe("GET /api/admin/transactions", () => {
  it("passes the month query param through", async () => {
    await GET(req("?month=2026-06"));
    expect(mockGet).toHaveBeenCalledWith("2026-06");
  });

  it("defaults to the current shop month when month is omitted", async () => {
    await GET(req());
    expect(mockGet).toHaveBeenCalledWith(expect.stringMatching(/^\d{4}-\d{2}$/));
  });
});
```

- [ ] **Step 10: Run it, confirm it fails**

Run: `npx vitest run app/api/admin/transactions`
Expected: FAIL — route doesn't exist.

- [ ] **Step 11: Implement the route**

```ts
// app/api/admin/transactions/route.ts
import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/api-auth";
import { shopMonthISO } from "@/lib/catalog";
import { getMonthTransactions } from "@/lib/transactions-overview";

export async function GET(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const month = new URL(req.url).searchParams.get("month") ?? shopMonthISO(new Date());
  const transactions = await getMonthTransactions(month);
  return NextResponse.json(transactions);
}
```

- [ ] **Step 12: Run it, confirm it passes**

Run: `npx vitest run app/api/admin/transactions`
Expected: PASS.

- [ ] **Step 13: Commit**

```bash
git add lib/catalog.ts lib/catalog.test.ts lib/transactions-overview.ts \
  lib/transactions-overview.test.ts app/api/admin/transactions
git commit -m "feat: add monthly transactions query (lib + API route)"
```

---

## Task 20: app/admin/catalog/transactions/page.tsx + sub-nav

**Files:**
- Create: `app/admin/catalog/transactions/page.tsx`
- Create: `app/admin/catalog/transactions/transactions-page.test.tsx`
- Modify: `app/admin/catalog/layout.tsx`

**Interfaces:**
- Consumes: `getMonthTransactions`/`MonthTransaction` (Task 19), `shopMonthISO`/`shiftMonth` (Task 19), `getOpenOrderProductIds` (Task 7), `<OrderButton>` (Task 8), `joinArtistNames` (existing).

- [ ] **Step 1: Write the failing tests**

```tsx
// app/admin/catalog/transactions/transactions-page.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock("@/lib/transactions-overview", () => ({ getMonthTransactions: vi.fn() }));
vi.mock("@/lib/open-order-lookup", () => ({ getOpenOrderProductIds: vi.fn() }));

import TransactionsPage from "@/app/admin/catalog/transactions/page";
import { getMonthTransactions } from "@/lib/transactions-overview";
import { getOpenOrderProductIds } from "@/lib/open-order-lookup";

const OUT_TX = {
  id: "t1",
  type: "OUT" as const,
  quantity: -1,
  createdAt: new Date("2026-08-03T14:30:00Z"),
  product: {
    id: "p1",
    title: "Torus",
    catalogNumber: "ZR-001",
    supplierId: "s1",
    label: { name: "Zulema" },
    productArtists: [{ position: 0, artist: { name: "Vril" } }],
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getOpenOrderProductIds).mockResolvedValue(new Set());
});

describe("/admin/catalog/transactions", () => {
  it("defaults to the current month and renders prev/next links", async () => {
    vi.mocked(getMonthTransactions).mockResolvedValue([]);
    const ui = await TransactionsPage({ searchParams: Promise.resolve({}) });
    render(ui);
    expect(screen.getByRole("link", { name: /prev/i })).toHaveAttribute(
      "href",
      expect.stringContaining("/admin/catalog/transactions?month="),
    );
    expect(screen.getByRole("link", { name: /next/i })).toHaveAttribute(
      "href",
      expect.stringContaining("/admin/catalog/transactions?month="),
    );
  });

  it("passes ?month= through and renders that month's transactions", async () => {
    vi.mocked(getMonthTransactions).mockResolvedValue([OUT_TX]);
    const ui = await TransactionsPage({ searchParams: Promise.resolve({ month: "2026-08" }) });
    render(ui);
    expect(getMonthTransactions).toHaveBeenCalledWith("2026-08");
    expect(screen.getByText("Torus")).toBeInTheDocument();
    expect(screen.getByText("Vril")).toBeInTheDocument();
    expect(screen.getByText("OUT")).toBeInTheDocument();
  });

  it("shows an Order button on an OUT row and none on an IN row", async () => {
    const inTx = { ...OUT_TX, id: "t2", type: "IN" as const, quantity: 5 };
    vi.mocked(getMonthTransactions).mockResolvedValue([OUT_TX, inTx]);
    const ui = await TransactionsPage({ searchParams: Promise.resolve({ month: "2026-08" }) });
    render(ui);
    expect(screen.getAllByRole("button", { name: /order/i })).toHaveLength(1);
  });

  it("shows an empty state for a month with no transactions", async () => {
    vi.mocked(getMonthTransactions).mockResolvedValue([]);
    const ui = await TransactionsPage({ searchParams: Promise.resolve({ month: "2026-08" }) });
    render(ui);
    expect(screen.getByText(/no transactions/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it, confirm it fails**

Run: `npx vitest run app/admin/catalog/transactions`
Expected: FAIL — page doesn't exist.

- [ ] **Step 3: Implement the page**

```tsx
// app/admin/catalog/transactions/page.tsx
import Link from "next/link";

import { shopMonthISO, shiftMonth, joinArtistNames } from "@/lib/catalog";
import { getMonthTransactions } from "@/lib/transactions-overview";
import { getOpenOrderProductIds } from "@/lib/open-order-lookup";
import { OrderButton } from "@/components/admin/OrderButton";

export const dynamic = "force-dynamic";

const MONTH_LABEL = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
const MONTH_PARAM = /^\d{4}-\d{2}$/;

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const sp = await searchParams;
  const month = sp.month && MONTH_PARAM.test(sp.month) ? sp.month : shopMonthISO(new Date());
  const prevMonth = shiftMonth(month, -1);
  const nextMonth = shiftMonth(month, 1);

  const transactions = await getMonthTransactions(month);
  const outProductIds = transactions.filter((t) => t.type === "OUT").map((t) => t.product.id);
  const openOrderProductIds = await getOpenOrderProductIds(outProductIds);

  const [year, mo] = month.split("-").map(Number);
  const monthLabel = MONTH_LABEL.format(new Date(Date.UTC(year, mo - 1, 1)));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Transactions</h1>

      <nav className="flex items-center justify-center gap-4 text-sm">
        <Link
          href={`/admin/catalog/transactions?month=${prevMonth}`}
          className="rounded border border-admin-hairline px-2 py-1 hover:bg-admin-raised"
        >
          ← Prev
        </Link>
        <span className="font-medium">Current selection: {monthLabel}</span>
        <Link
          href={`/admin/catalog/transactions?month=${nextMonth}`}
          className="rounded border border-admin-hairline px-2 py-1 hover:bg-admin-raised"
        >
          Next →
        </Link>
      </nav>

      {transactions.length === 0 ? (
        <p className="rounded border border-dashed border-admin-hairline p-8 text-center text-admin-ink-muted">
          No transactions in {monthLabel}.
        </p>
      ) : (
        <div className="overflow-x-auto rounded border border-admin-hairline bg-admin-surface">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-admin-hairline bg-admin-bg text-xs text-admin-ink-muted">
              <tr>
                <th className="px-3 py-2 font-medium">Order</th>
                <th className="px-3 py-2 font-medium">Date</th>
                <th className="px-3 py-2 font-medium">Time</th>
                <th className="px-3 py-2 font-medium">Labelcode</th>
                <th className="px-3 py-2 font-medium">Artist</th>
                <th className="px-3 py-2 font-medium">Title</th>
                <th className="px-3 py-2 font-medium">Label</th>
                <th className="px-3 py-2 font-medium">Qty</th>
                <th className="px-3 py-2 font-medium">Type</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-admin-hairline">
              {transactions.map((t) => (
                <tr key={t.id}>
                  <td className="px-3 py-2">
                    {t.type === "OUT" && (
                      <OrderButton
                        productId={t.product.id}
                        hasSupplier={!!t.product.supplierId}
                        initiallyOrdered={openOrderProductIds.has(t.product.id)}
                      />
                    )}
                  </td>
                  <td className="px-3 py-2 text-admin-ink-muted">
                    {t.createdAt.toLocaleDateString()}
                  </td>
                  <td className="px-3 py-2 text-admin-ink-muted">
                    {t.createdAt.toLocaleTimeString()}
                  </td>
                  <td className="px-3 py-2 text-admin-ink-muted">{t.product.catalogNumber ?? "—"}</td>
                  <td className="px-3 py-2">{joinArtistNames(t.product.productArtists)}</td>
                  <td className="px-3 py-2">{t.product.title}</td>
                  <td className="px-3 py-2 text-admin-ink-muted">{t.product.label.name}</td>
                  <td className="px-3 py-2 tabular-nums">
                    {t.quantity > 0 ? `+${t.quantity}` : t.quantity}
                  </td>
                  <td className="px-3 py-2">{t.type}</td>
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

- [ ] **Step 4: Run it, confirm it passes**

Run: `npx vitest run app/admin/catalog/transactions`
Expected: PASS.

- [ ] **Step 5: Add the sub-nav entry — write the failing test first**

Read `app/admin/catalog/layout.tsx`'s existing test (if one exists: `find app/admin/catalog -maxdepth 1 -iname "layout*test*"`) and add a case asserting a "Transactions" link exists pointing at `/admin/catalog/transactions`. If no layout test file exists, skip straight to Step 6 — the `catalog.test.tsx`/`orders-page.test.tsx`/`transactions-page.test.tsx` suites already exercise `AdminSubNav` indirectly through each page's render, but `AdminSubNav` itself is a shared, already-tested component (`components/layout/AdminSubNav.tsx`) — this step is just adding one more item to a plain array literal, not new logic.

- [ ] **Step 6: Add the nav item**

In `app/admin/catalog/layout.tsx`:

```tsx
const ITEMS = [
  { href: "/admin/catalog", label: "Catalog" },
  { href: "/admin/catalog/reference", label: "Reference data" },
  { href: "/admin/catalog/orders", label: "Orders" },
  { href: "/admin/catalog/transactions", label: "Transactions" },
];
```

- [ ] **Step 7: Run the full catalog admin test directory, confirm green**

Run: `npx vitest run app/admin/catalog`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add app/admin/catalog/transactions app/admin/catalog/layout.tsx
git commit -m "feat: add monthly transactions page and sub-nav entry"
```

---

## Task 21: Close-out — full suite, lint, docs, backlog

**Files:**
- Create: `docs/features/NNN-order-transaction-redesign.md` (pick the next free number in `docs/features/`)
- Modify: `tasks/todo.md` (add "Export PDF per supplier group" to the backlog; update the test-count baseline if one is tracked there)
- Create: `docs/sessions/2026-08-06.md` (using `docs/session-log-template.md`)
- Modify: `tasks/lessons.md` (only if something genuinely surprising came up during implementation — don't force an entry)

**Interfaces:**
- None — this task produces no code, only verification and documentation.

- [ ] **Step 1: Run the full test suite via the run-tests skill**

Use the run-tests skill (`scripts/run-tests.sh`) — do not construct a custom `vitest` invocation for this step.
Expected: all tests pass, including every test written across Tasks 1–20.

- [ ] **Step 2: Run lint and typecheck**

Run: `npm run lint`
Run: `npm run typecheck`
Expected: both clean. Fix anything that surfaces before proceeding — don't defer lint/type errors past this task.

- [ ] **Step 3: Manual browser walkthrough**

With the dev server running against a migrated local database: create a supplier → link it to a label and (separately) to a product via the product form → click "Order" on that product's catalog row (button flips to "Ordered") → visit `/admin/catalog/orders`, confirm the line appears grouped under the supplier → edit the line's quantity inline → click "Mark received", confirm the quantity, confirm the product's stock quantity increases and a DYMO preview/print fires per the `DYMO_MODE` env setting → click "Mark all as sent" on the supplier group → visit `/admin/catalog/transactions`, confirm the resulting `IN` row appears under the correct month with correct date/time → find an `OUT` row (from a prior sale) and confirm its "Order" button quick-adds correctly. Toggle the auto-print checkbox, reload the page, confirm it's still checked.

- [ ] **Step 4: Add the Export PDF backlog item**

In `tasks/todo.md`, under whatever backlog section already exists for catalog/admin follow-ups (or create a small "Orders" backlog entry if none fits), add: "Export PDF per supplier group on the orders overview page (`/admin/catalog/orders`) — button already present, currently disabled." If the file tracks a test-count baseline number, update it to match Step 1's final count.

- [ ] **Step 5: Write the feature doc**

Find the next free number: `ls docs/features/ | sort`. Write `docs/features/NNN-order-transaction-redesign.md` summarizing what changed (mirror the structure of `docs/features/stock-management.md`: Summary, Data model, New/changed admin surfaces, Removed surfaces, Tests & verification, Known gaps — the Export PDF button is a known/accepted gap, not a bug).

- [ ] **Step 6: Write the session log**

Fill in `docs/sessions/2026-08-06.md` using `docs/session-log-template.md`.

- [ ] **Step 7: Update tasks/lessons.md if warranted**

Only if something during Tasks 1–20 surprised you in a way future work should avoid repeating (e.g. a migration quirk beyond what's already documented, a test-mocking gotcha specific to the new `groupBy` discriminated union, etc.). Skip this step if nothing qualifies — don't manufacture a lesson.

- [ ] **Step 8: Commit the docs**

```bash
git add docs/features tasks/todo.md docs/sessions tasks/lessons.md
git commit -m "docs: close out order & transaction redesign — feature doc, session log"
```

- [ ] **Step 9: Request `/code-review`**

This branch touches a schema migration and multiple new/changed API contracts — per `docs/instructions/branching.md` and `CLAUDE.md`, `/code-review` is mandatory before merge. Tell the user the branch is ready and ask them to run it (per this repo's convention, `/code-review` cannot self-invoke). Fix all Medium+ findings, re-run the full suite, then proceed to the merge steps in `docs/instructions/branching.md` (fast-forward merge to `master`, delete the feature branch, push).
