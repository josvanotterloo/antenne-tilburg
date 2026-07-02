import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  const products = await db.product.findMany({
    orderBy: [{ artist: "asc" }, { title: "asc" }],
    include: { label: true, genre: true, productType: true },
  });
  return NextResponse.json(products);
}
