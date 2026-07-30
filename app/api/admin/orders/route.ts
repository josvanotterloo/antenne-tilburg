import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { parseSupplyOrderInput } from "@/lib/supply-order-input";

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  const orders = await db.supplyOrder.findMany({
    orderBy: { orderedAt: "desc" },
    include: { supplier: true, lines: true },
  });
  return NextResponse.json(orders);
}

export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const parsed = parseSupplyOrderInput(await req.json().catch(() => null));
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  try {
    const created = await db.supplyOrder.create({
      data: {
        supplierId: parsed.data.supplierId,
        reference: parsed.data.reference,
        notes: parsed.data.notes,
        orderedAt: new Date(parsed.data.orderedAt),
        lines: {
          create: parsed.data.lines.map((line) => ({
            productId: line.productId,
            quantityOrdered: line.quantityOrdered,
          })),
        },
      },
      include: { supplier: true, lines: true },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    if ((error as { code?: string } | null)?.code === "P2025") {
      return NextResponse.json(
        { error: "Selected supplier or product no longer exists" },
        { status: 400 },
      );
    }
    throw error;
  }
}
