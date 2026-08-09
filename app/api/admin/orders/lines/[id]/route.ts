import { Prisma } from "@prisma/client";
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

type DeleteLineResult = { ok: true } | { ok: false; status: 404 | 409; error: string };

interface LockedOrderLine {
  quantityOrdered: number;
  quantityReceived: number;
  orderStatus: "PENDING" | "PARTIAL" | "RECEIVED";
}

// A plain `findUnique` here would NOT close the race this guards against:
// under Postgres READ COMMITTED a bare SELECT takes no row lock, so a
// concurrent PATCH .../receive could commit (bumping quantityReceived,
// flipping the order status, inserting a StockTransaction) in the gap
// between this read and the delete below — and the delete would proceed
// against the stale in-memory booleans regardless. `FOR UPDATE OF sl` locks
// the SupplyOrderLine row for the rest of this transaction, so a concurrent
// receive's `tx.supplyOrderLine.update(...)` on the same row blocks until
// this transaction commits or rolls back — same locking-read pattern this
// codebase already uses in lib/stock.ts's applyStockTransaction (there via
// `SELECT ... FOR UPDATE` on Product before writing it). Do not "simplify"
// this back to `tx.supplyOrderLine.findUnique(...)`.
async function findLineForDelete(
  tx: Prisma.TransactionClient,
  id: string,
): Promise<LockedOrderLine | null> {
  const rows = await tx.$queryRaw<LockedOrderLine[]>(
    Prisma.sql`
      SELECT sl."quantityOrdered"  AS "quantityOrdered",
             sl."quantityReceived" AS "quantityReceived",
             so.status              AS "orderStatus"
      FROM "SupplyOrderLine" sl
      JOIN "SupplyOrder" so ON so.id = sl."supplyOrderId"
      WHERE sl.id = ${id}
      FOR UPDATE OF sl
    `,
  );
  return rows[0] ?? null;
}

// Guards + delete run inside the caller's transaction, against a row locked
// by findLineForDelete above, so the guard checks are evaluated atomically
// with the delete against fresh, lock-serialized data — a concurrent
// PATCH .../receive can't slip into the gap between the guard checks and
// the delete (see the DELETE handler below, and findLineForDelete's comment
// for why the lock is what actually makes that true).
async function deleteOrderLine(tx: Prisma.TransactionClient, id: string): Promise<DeleteLineResult> {
  const line = await findLineForDelete(tx, id);
  if (!line) {
    return { ok: false, status: 404, error: "Not found" };
  }
  if (line.orderStatus !== "PENDING") {
    return {
      ok: false,
      status: 409,
      error: "Cannot remove a line once the order is partially or fully received.",
    };
  }
  if (line.quantityReceived > 0) {
    return { ok: false, status: 409, error: "Cannot remove a line once it has received quantity." };
  }

  await tx.supplyOrderLine.delete({ where: { id } });
  return { ok: true };
}

// Undo for a mis-clicked quick-add. Only safe while the order is still
// PENDING and nothing has been received against this line yet — once any
// receiving has happened the order status has already moved off PENDING, so
// the quantityReceived check below is defense-in-depth, not the primary
// guard. The read-check-delete sequence runs inside db.$transaction so a
// concurrent .../receive can't commit in the gap between the read and the
// delete (which would otherwise orphan a StockTransaction row).
export async function DELETE(_req: Request, ctx: RouteContext) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await ctx.params;

  const result = await db.$transaction((tx) => deleteOrderLine(tx, id));
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ ok: true });
}
