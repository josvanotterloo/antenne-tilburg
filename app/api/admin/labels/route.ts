import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { prismaErrorResponse } from "@/lib/prisma-error";
import { parseLabelInput } from "@/lib/label-input";
import {
  normalizeReferenceName,
  findDuplicateByNormalizedName,
} from "@/lib/reference-dedupe";

const SEARCH_LIMIT = 20;

// Bespoke, not lib/reference-crud.ts's generic factory — Label carries an
// optional supplierId that Genre/ProductType don't, same reason Supplier
// already has its own route file.
export async function GET(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  const rows = await db.label.findMany({
    where: q ? { name: { contains: q, mode: "insensitive" } } : undefined,
    orderBy: { name: "asc" },
    take: SEARCH_LIMIT,
    include: { _count: { select: { products: true } }, supplier: true },
  });
  const items = rows.map((r) => ({
    id: r.id,
    name: r.name,
    productCount: r._count.products,
    supplierId: r.supplier?.id ?? null,
    supplierName: r.supplier?.name ?? null,
  }));
  return NextResponse.json(items);
}

export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const parsed = parseLabelInput(await req.json().catch(() => null));
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  if (await findDuplicateByNormalizedName(db.label, parsed.data.name)) {
    return NextResponse.json(
      { error: `"${parsed.data.name}" already exists` },
      { status: 409 },
    );
  }
  try {
    const created = await db.label.create({
      data: {
        name: parsed.data.name,
        normalizedName: normalizeReferenceName(parsed.data.name),
        supplierId: parsed.data.supplierId,
      },
      include: { supplier: true },
    });
    return NextResponse.json(
      {
        id: created.id,
        name: created.name,
        supplierId: created.supplier?.id ?? null,
        supplierName: created.supplier?.name ?? null,
      },
      { status: 201 },
    );
  } catch (error) {
    // Same P2003-not-P2025 reasoning as labels/[id]/route.ts's PATCH: a
    // dangling supplierId is a scalar FK violation on create too.
    const response = prismaErrorResponse(error, {
      P2002: { status: 409, body: { error: `"${parsed.data.name}" already exists` } },
      P2003: { status: 400, body: { error: "Selected supplier no longer exists" } },
    });
    if (response) return response;
    throw error;
  }
}
