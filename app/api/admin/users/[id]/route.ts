import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { NOT_FOUND, prismaErrorResponse } from "@/lib/prisma-error";
import { parseEmailChange } from "@/lib/user-input";

type RouteContext = { params: Promise<{ id: string }> };

// Never expose passwordHash.
const publicSelect = { id: true, email: true, createdAt: true } as const;

export async function GET(_req: Request, ctx: RouteContext) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await ctx.params;
  const user = await db.user.findUnique({ where: { id }, select: publicSelect });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(user);
}

export async function PATCH(req: Request, ctx: RouteContext) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await ctx.params;
  const parsed = parseEmailChange(await req.json().catch(() => null));
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const updated = await db.user.update({
      where: { id },
      data: { email: parsed.data.email },
      select: publicSelect,
    });
    return NextResponse.json(updated);
  } catch (error) {
    const response = prismaErrorResponse(error, {
      P2002: { status: 409, body: { error: "That email is already in use" } },
      P2025: NOT_FOUND,
    });
    if (response) return response;
    throw error;
  }
}
