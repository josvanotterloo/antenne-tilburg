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
