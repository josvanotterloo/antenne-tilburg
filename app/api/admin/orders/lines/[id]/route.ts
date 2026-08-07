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
