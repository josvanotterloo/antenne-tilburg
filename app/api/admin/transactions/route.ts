import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/api-auth";
import { shopMonthISO } from "@/lib/catalog";
import { getMonthTransactions } from "@/lib/transactions-overview";

export async function GET(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const month = new URL(req.url).searchParams.get("month") ?? shopMonthISO(new Date());
  const transactions = await getMonthTransactions(month);
  return NextResponse.json(transactions);
}
