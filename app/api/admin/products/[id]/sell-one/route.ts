import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { sellOne } from "@/lib/stock";

type RouteContext = { params: Promise<{ id: string }> };

// Sell one unit: decrement quantity by 1 (floored at 0) and keep inStock in sync.
// Single-click admin action, no confirmation.
export async function POST(_req: Request, ctx: RouteContext) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await ctx.params;
  const product = await db.product.findUnique({
    where: { id },
    select: { quantity: true },
  });
  if (!product) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updated = await db.product.update({
    where: { id },
    data: sellOne(product.quantity),
  });
  return NextResponse.json(updated);
}
