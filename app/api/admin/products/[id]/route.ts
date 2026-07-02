import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { parseProductInput, toProductData } from "@/lib/product-input";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: RouteContext) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await ctx.params;
  const product = await db.product.findUnique({
    where: { id },
    include: { label: true, genre: true, productType: true },
  });
  if (!product) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(product);
}

export async function PATCH(req: Request, ctx: RouteContext) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await ctx.params;
  const parsed = parseProductInput(await req.json().catch(() => null));
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const updated = await db.product.update({
    where: { id },
    data: toProductData(parsed.data),
  });
  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, ctx: RouteContext) {
  const denied = await requireAdmin();
  if (denied) return denied;

  // Products are leaf entities — no dependents, so no delete guard.
  const { id } = await ctx.params;
  try {
    await db.product.delete({ where: { id } });
  } catch (error) {
    // Prisma "record not found" (e.g. already deleted by another admin).
    if ((error as { code?: string } | null)?.code === "P2025") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    throw error;
  }
  return NextResponse.json({ ok: true });
}
