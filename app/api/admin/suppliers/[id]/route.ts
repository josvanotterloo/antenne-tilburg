import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { NOT_FOUND, prismaErrorResponse } from "@/lib/prisma-error";
import { parseSupplierInput } from "@/lib/supplier-input";

type RouteContext = { params: Promise<{ id: string }> };

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
    const response = prismaErrorResponse(error, {
      P2002: { status: 409, body: { error: `"${parsed.data.name}" already exists` } },
      P2025: NOT_FOUND,
    });
    if (response) return response;
    throw error;
  }
}

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
    (supplier._count.supplyOrders ?? 0) +
    (supplier._count.products ?? 0) +
    (supplier._count.labels ?? 0);
  if (inUseCount > 0) {
    return NextResponse.json(
      { error: `In use by ${inUseCount} record(s)`, count: inUseCount },
      { status: 409 },
    );
  }
  await db.supplier.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
