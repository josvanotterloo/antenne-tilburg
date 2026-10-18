import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { parseLabelInput } from "@/lib/label-input";
import {
  normalizeReferenceName,
  findDuplicateByNormalizedName,
} from "@/lib/reference-dedupe";

type RouteContext = { params: Promise<{ id: string }> };

function isUniqueViolation(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === "P2002";
}

export async function PATCH(req: Request, ctx: RouteContext) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await ctx.params;
  const parsed = parseLabelInput(await req.json().catch(() => null));
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const normalizedName = normalizeReferenceName(parsed.data.name);
  // A rename that doesn't actually change the normalized name (e.g. editing
  // only the supplier) must never be blocked by another label's legacy
  // near-duplicate — see the matching comment in lib/reference-crud.ts's
  // itemHandlers.PATCH.
  const current = await db.label.findUnique({ where: { id }, select: { normalizedName: true } });
  const nameUnchanged = current?.normalizedName === normalizedName;
  if (
    !nameUnchanged &&
    (await findDuplicateByNormalizedName(db.label, parsed.data.name, id))
  ) {
    return NextResponse.json(
      { error: `"${parsed.data.name}" already exists` },
      { status: 409 },
    );
  }
  try {
    const updated = await db.label.update({
      where: { id },
      data: {
        name: parsed.data.name,
        normalizedName,
        supplierId: parsed.data.supplierId,
      },
      include: { supplier: true },
    });
    return NextResponse.json({
      id: updated.id,
      name: updated.name,
      supplierId: updated.supplier?.id ?? null,
      supplierName: updated.supplier?.name ?? null,
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return NextResponse.json(
        { error: `"${parsed.data.name}" already exists` },
        { status: 409 },
      );
    }
    if ((error as { code?: string } | null)?.code === "P2025") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    throw error;
  }
}

export async function DELETE(_req: Request, ctx: RouteContext) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await ctx.params;
  const label = await db.label.findUnique({
    where: { id },
    include: { _count: { select: { products: true } } },
  });
  if (!label) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (label._count.products > 0) {
    return NextResponse.json(
      { error: `In use by ${label._count.products} products`, count: label._count.products },
      { status: 409 },
    );
  }
  await db.label.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
