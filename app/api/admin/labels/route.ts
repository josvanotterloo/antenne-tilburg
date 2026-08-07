import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { parseLabelInput } from "@/lib/label-input";

const SEARCH_LIMIT = 20;

function isUniqueViolation(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === "P2002";
}

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
  try {
    const created = await db.label.create({
      data: { name: parsed.data.name, supplierId: parsed.data.supplierId },
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
    if (isUniqueViolation(error)) {
      return NextResponse.json(
        { error: `"${parsed.data.name}" already exists` },
        { status: 409 },
      );
    }
    throw error;
  }
}
