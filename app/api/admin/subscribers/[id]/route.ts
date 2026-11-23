import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { NOT_FOUND, prismaErrorResponse } from "@/lib/prisma-error";

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(_req: Request, ctx: RouteContext) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await ctx.params;
  try {
    await db.newsletterSubscriber.delete({ where: { id } });
  } catch (error) {
    const response = prismaErrorResponse(error, { P2025: NOT_FOUND });
    if (response) return response;
    throw error;
  }
  return NextResponse.json({ ok: true });
}
