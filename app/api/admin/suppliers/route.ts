import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { prismaErrorResponse } from "@/lib/prisma-error";
import { parseSupplierInput } from "@/lib/supplier-input";

const SEARCH_LIMIT = 20;

// ?q= typeahead — same contract as lib/reference-crud.ts's GET, so the
// existing Combobox component works against this route unmodified.
export async function GET(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  const suppliers = await db.supplier.findMany({
    where: q ? { name: { contains: q, mode: "insensitive" } } : undefined,
    orderBy: { name: "asc" },
    take: SEARCH_LIMIT,
  });
  return NextResponse.json(suppliers);
}

export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const parsed = parseSupplierInput(await req.json().catch(() => null));
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  try {
    const created = await db.supplier.create({ data: parsed.data });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    const response = prismaErrorResponse(error, {
      P2002: { status: 409, body: { error: `"${parsed.data.name}" already exists` } },
    });
    if (response) return response;
    throw error;
  }
}
