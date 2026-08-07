import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";

type RouteContext = { params: Promise<{ id: string }> };

// GET (single-order detail) and PATCH's old "replace all lines" behavior
// were removed along with the manual order create/edit/detail pages they
// served (see Task 18) — ordering is now purely product-driven (quick-add)
// plus the grouped overview page's inline actions. This file now only
// supports "mark all as sent" and cancelling a mistaken order.

export async function PATCH(req: Request, ctx: RouteContext) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await ctx.params;

  const body = (await req.json().catch(() => null)) as { status?: unknown } | null;
  if (body?.status !== "SENT") {
    return NextResponse.json(
      { error: 'Only { status: "SENT" } is supported' },
      { status: 400 },
    );
  }

  const existing = await db.supplyOrder.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (existing.status === "RECEIVED") {
    return NextResponse.json(
      { error: "This order has already been fully received" },
      { status: 409 },
    );
  }

  // Already sent — a no-op that preserves the original first-sent timestamp
  // rather than bumping it on every click.
  if (existing.sentAt !== null) {
    return NextResponse.json(existing);
  }

  const updated = await db.supplyOrder.update({ where: { id }, data: { sentAt: new Date() } });
  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, ctx: RouteContext) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await ctx.params;
  const existing = await db.supplyOrder.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (existing.status !== "PENDING") {
    return NextResponse.json({ error: "Only a pending order can be deleted" }, { status: 409 });
  }
  await db.supplyOrder.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
