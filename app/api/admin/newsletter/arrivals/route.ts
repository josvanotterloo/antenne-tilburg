import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/api-auth";
import { shopDayRange } from "@/lib/catalog";
import { getNewArrivals } from "@/lib/newsletter-arrivals";

// Admin-only: the composer's "Load arrivals" — in-stock products created in
// the given shop-local date range, grouped by genre, restocks flagged.
export async function GET(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const params = new URL(req.url).searchParams;
  const range = shopDayRange(params.get("from") ?? "", params.get("to") ?? "");
  if (!range) {
    return NextResponse.json(
      { error: "A valid from/to date range is required" },
      { status: 400 },
    );
  }

  return NextResponse.json(await getNewArrivals(range));
}
