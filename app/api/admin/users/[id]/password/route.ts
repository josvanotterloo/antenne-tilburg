import { NextResponse } from "next/server";
import { compare, hash } from "bcrypt";

import { requireAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { parsePasswordChange } from "@/lib/user-input";

type RouteContext = { params: Promise<{ id: string }> };

const SALT_ROUNDS = 12;

export async function PUT(req: Request, ctx: RouteContext) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const parsed = parsePasswordChange(await req.json().catch(() => null));
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const { id } = await ctx.params;
  const user = await db.user.findUnique({ where: { id } });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const valid = await compare(parsed.data.currentPassword, user.passwordHash);
  if (!valid) {
    return NextResponse.json(
      { error: "Current password is incorrect" },
      { status: 403 },
    );
  }

  const passwordHash = await hash(parsed.data.newPassword, SALT_ROUNDS);
  await db.user.update({ where: { id }, data: { passwordHash } });
  return NextResponse.json({ ok: true });
}
