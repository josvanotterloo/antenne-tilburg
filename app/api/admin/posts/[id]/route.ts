import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { NOT_FOUND, prismaErrorResponse } from "@/lib/prisma-error";
import { parsePostInput } from "@/lib/post-input";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: RouteContext) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await ctx.params;
  const post = await db.post.findUnique({ where: { id } });
  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(post);
}

export async function PATCH(req: Request, ctx: RouteContext) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await ctx.params;
  const parsed = parsePostInput(await req.json().catch(() => null));
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const existing = await db.post.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Stamp publishedAt the first time a post goes live; keep drafts unpublished.
  const publishedAt =
    parsed.data.status === "PUBLISHED"
      ? (existing.publishedAt ?? new Date())
      : existing.publishedAt;

  try {
    const updated = await db.post.update({
      where: { id },
      data: { ...parsed.data, publishedAt },
    });
    return NextResponse.json(updated);
  } catch (error) {
    const response = prismaErrorResponse(error, {
      P2002: { status: 409, body: { error: `Slug "${parsed.data.slug}" already exists` } },
    });
    if (response) return response;
    throw error;
  }
}

export async function DELETE(_req: Request, ctx: RouteContext) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await ctx.params;
  try {
    await db.post.delete({ where: { id } });
  } catch (error) {
    const response = prismaErrorResponse(error, { P2025: NOT_FOUND });
    if (response) return response;
    throw error;
  }
  return NextResponse.json({ ok: true });
}
