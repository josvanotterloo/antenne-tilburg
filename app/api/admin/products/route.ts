import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { parseProductInput, toProductData } from "@/lib/product-input";

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  const products = await db.product.findMany({
    orderBy: [{ artist: "asc" }, { title: "asc" }],
    include: { label: true, genre: true, productType: true },
  });
  return NextResponse.json(products);
}

export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const parsed = parseProductInput(await req.json().catch(() => null));
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const created = await db.product.create({ data: toProductData(parsed.data) });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    // A labelId/genreId/productTypeId that doesn't exist (e.g. deleted by the
    // other admin) makes the nested connect throw P2025 — a client error, not a
    // 500 leaking Prisma internals.
    if ((error as { code?: string } | null)?.code === "P2025") {
      return NextResponse.json(
        { error: "Selected label, genre or product type no longer exists" },
        { status: 400 },
      );
    }
    throw error;
  }
}
