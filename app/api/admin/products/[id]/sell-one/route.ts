import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { requireAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";

type RouteContext = { params: Promise<{ id: string }> };

// Sell one unit. A single atomic UPDATE floors quantity at 0 and keeps inStock in
// sync, so concurrent clicks can't lose a decrement (each statement sees the
// committed row) and there's no read-then-write race. Single click, no confirm.
export async function POST(_req: Request, ctx: RouteContext) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await ctx.params;
  const rows = await db.$queryRaw<
    { id: string; quantity: number; inStock: boolean }[]
  >(Prisma.sql`
    UPDATE "Product"
    SET "quantity" = GREATEST(0, "quantity" - 1),
        "inStock"  = GREATEST(0, "quantity" - 1) > 0
    WHERE "id" = ${id}
    RETURNING "id", "quantity", "inStock"
  `);

  if (rows.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(rows[0]);
}
