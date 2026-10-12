import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { applyStockTransaction } from "@/lib/stock";

type RouteContext = { params: Promise<{ id: string }> };

// Mirrors sell-one — always an IN transaction of +1, no reason (spec-admin-
// stock-artist.md A3). No upper bound to floor/ceiling against.
export async function POST(_req: Request, ctx: RouteContext) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await ctx.params;
  const result = await db.$transaction((tx) =>
    applyStockTransaction(tx, { productId: id, type: "IN", requestedQuantity: 1 }),
  );

  if (!result.ok) {
    const status = result.error === "Product not found" ? 404 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }
  return NextResponse.json({ id, quantity: result.quantity, inStock: result.quantity > 0 });
}
