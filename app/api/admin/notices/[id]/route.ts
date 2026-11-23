import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { NOT_FOUND, prismaErrorResponse } from "@/lib/prisma-error";
import { parseNoticeInput } from "@/lib/notice-input";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: RouteContext) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await ctx.params;
  const notice = await db.notice.findUnique({ where: { id } });
  if (!notice) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(notice);
}

export async function PATCH(req: Request, ctx: RouteContext) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await ctx.params;
  const parsed = parseNoticeInput(await req.json().catch(() => null));
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const updated = await db.notice.update({
      where: { id },
      data: parsed.data,
    });
    return NextResponse.json(updated);
  } catch (error) {
    const response = prismaErrorResponse(error, { P2025: NOT_FOUND });
    if (response) return response;
    throw error;
  }
}

export async function DELETE(_req: Request, ctx: RouteContext) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await ctx.params;
  try {
    await db.notice.delete({ where: { id } });
  } catch (error) {
    const response = prismaErrorResponse(error, { P2025: NOT_FOUND });
    if (response) return response;
    throw error;
  }
  return NextResponse.json({ ok: true });
}
