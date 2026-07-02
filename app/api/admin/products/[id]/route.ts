import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(_req: Request, ctx: RouteContext) {
  const denied = await requireAdmin();
  if (denied) return denied;

  // Products are leaf entities — no dependents, so no delete guard.
  const { id } = await ctx.params;
  await db.product.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
