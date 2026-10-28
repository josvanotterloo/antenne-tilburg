import { NextResponse } from "next/server";

import { requireAdmin, requireAdminUserId } from "@/lib/api-auth";
import { withRequestContext } from "@/lib/log/context";
import {
  MAX_CUSTOMER_ORDERS_BYTES,
  readCustomerOrders,
  writeCustomerOrders,
} from "@/lib/customer-orders";

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  return NextResponse.json({ content: await readCustomerOrders() });
}

export async function POST(req: Request) {
  return withRequestContext(req, async () => {
    const adminCheck = await requireAdminUserId();
    if (adminCheck.denied) return adminCheck.denied;

    const body = await req.json().catch(() => null);
    if (typeof body?.content !== "string") {
      return NextResponse.json({ error: "content is required" }, { status: 400 });
    }
    if (Buffer.byteLength(body.content, "utf-8") > MAX_CUSTOMER_ORDERS_BYTES) {
      return NextResponse.json(
        { error: "content is too large (max 500 KB)" },
        { status: 400 },
      );
    }

    await writeCustomerOrders(body.content, adminCheck.userId);
    return NextResponse.json({ ok: true });
  });
}
