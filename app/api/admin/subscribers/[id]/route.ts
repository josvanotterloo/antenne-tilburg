import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(_req: Request, ctx: RouteContext) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await ctx.params;
  try {
    await db.newsletterSubscriber.delete({ where: { id } });
  } catch (error) {
    if ((error as { code?: string } | null)?.code === "P2025") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    throw error;
  }
  return NextResponse.json({ ok: true });
}
