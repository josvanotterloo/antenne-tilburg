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
