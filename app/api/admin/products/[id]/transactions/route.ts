import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { computeRunningBalance } from "@/lib/stock-history";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: RouteContext) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await ctx.params;
  const rows = await db.stockTransaction.findMany({
    where: { productId: id },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true, type: true, quantity: true, note: true, createdAt: true },
  });
  return NextResponse.json(computeRunningBalance(rows));
}
