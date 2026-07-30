import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { applyStockTransaction } from "@/lib/stock";

type RouteContext = { params: Promise<{ id: string }> };

// Sell one unit — always an OUT transaction of -1. Floors at zero and 400s
// if there's nothing left to sell (button is disabled client-side at 0; this
// is the server-side backstop for a race between two rapid clicks).
export async function POST(_req: Request, ctx: RouteContext) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await ctx.params;
  const result = await db.$transaction((tx) =>
    applyStockTransaction(tx, { productId: id, type: "OUT", requestedQuantity: -1 }),
  );

  if (!result.ok) {
    const status = result.error === "Product not found" ? 404 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }
  return NextResponse.json({ id, quantity: result.quantity, inStock: result.quantity > 0 });
}
