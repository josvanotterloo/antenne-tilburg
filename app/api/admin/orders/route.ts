import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/api-auth";
import { getOpenOrderLines, type GroupBy } from "@/lib/order-overview";

const VALID_GROUP_BY = new Set(["supplier", "date", "flat"]);

export async function GET(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const raw = new URL(req.url).searchParams.get("groupBy") ?? "supplier";
  const groupBy = (VALID_GROUP_BY.has(raw) ? raw : "supplier") as GroupBy;
  const result = await getOpenOrderLines(groupBy);
  return NextResponse.json(result);
}
