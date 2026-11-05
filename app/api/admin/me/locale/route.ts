import { NextResponse } from "next/server";

import { requireAdminUserId } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { parseLocaleChange } from "@/lib/user-input";

// Self-scoped: the user id always comes from the session, never from the
// request body, so one admin can never flip another admin's locale.
export async function PATCH(req: Request) {
  const adminCheck = await requireAdminUserId();
  if (adminCheck.denied) return adminCheck.denied;

  const parsed = parseLocaleChange(await req.json().catch(() => null));
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  await db.user.update({
    where: { id: adminCheck.userId },
    data: { locale: parsed.data.locale },
  });
  return NextResponse.json({ ok: true });
}
