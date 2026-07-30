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
