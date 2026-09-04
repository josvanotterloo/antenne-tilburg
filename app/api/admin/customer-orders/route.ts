import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/api-auth";
import { readCustomerOrders, writeCustomerOrders } from "@/lib/customer-orders";

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  return NextResponse.json({ content: await readCustomerOrders() });
}

export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const body = await req.json().catch(() => null);
  if (typeof body?.content !== "string") {
    return NextResponse.json({ error: "content is required" }, { status: 400 });
  }

  await writeCustomerOrders(body.content);
  return NextResponse.json({ ok: true });
}
