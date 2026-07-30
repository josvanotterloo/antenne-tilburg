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
