import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { quickAddToOrder } from "@/lib/supply-order-quick-add";

export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const body = (await req.json().catch(() => null)) as { productId?: unknown } | null;
  const productId = typeof body?.productId === "string" ? body.productId.trim() : "";
  if (!productId) {
    return NextResponse.json({ error: "productId is required" }, { status: 400 });
  }

  const result = await db.$transaction((tx) => quickAddToOrder(tx, { productId }));
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result.line, { status: result.status });
}
