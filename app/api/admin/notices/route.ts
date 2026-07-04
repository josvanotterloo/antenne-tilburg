import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { parseNoticeInput } from "@/lib/notice-input";

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  const notices = await db.notice.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json(notices);
}

export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const parsed = parseNoticeInput(await req.json().catch(() => null));
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const created = await db.notice.create({ data: parsed.data });
  return NextResponse.json(created, { status: 201 });
}
