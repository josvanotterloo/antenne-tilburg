import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { parseOrderLineQuantityInput } from "@/lib/order-line-input";

type RouteContext = { params: Promise<{ id: string }> };

// Shared by PATCH (reads via plain `db`) and DELETE (reads via a
// transaction client, see below) — same query shape, different client type.
function findLineWithOrder(client: Prisma.TransactionClient | typeof db, id: string) {
  return client.supplyOrderLine.findUnique({
    where: { id },
    include: { supplyOrder: true },
  });
}

export async function PATCH(req: Request, ctx: RouteContext) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await ctx.params;

  const parsed = parseOrderLineQuantityInput(await req.json().catch(() => null));
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const line = await findLineWithOrder(db, id);
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

// Guards + delete run inside the caller's transaction so the read is fresh
// at delete time — a concurrent PATCH .../receive can't slip into the gap
// between the guard checks and the delete (see the DELETE handler below).
async function deleteOrderLine(tx: Prisma.TransactionClient, id: string): Promise<DeleteLineResult> {
  const line = await findLineWithOrder(tx, id);
  if (!line) {
    return { ok: false, status: 404, error: "Not found" };
  }
  if (line.supplyOrder.status !== "PENDING") {
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
