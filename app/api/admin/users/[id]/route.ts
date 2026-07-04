import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";
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
    const code = (error as { code?: string } | null)?.code;
    if (code === "P2002") {
      return NextResponse.json(
        { error: "That email is already in use" },
        { status: 409 },
      );
    }
    if (code === "P2025") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    throw error;
  }
}
