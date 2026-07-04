import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { parseOpeningHoursInput } from "@/lib/opening-hours";

// Bulk-save the weekly grid: upsert every submitted day in one transaction.
export async function PUT(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const parsed = parseOpeningHoursInput(await req.json().catch(() => null));
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  await db.$transaction(
    parsed.data.map((row) =>
      db.openingHours.upsert({
        where: { dayOfWeek: row.dayOfWeek },
        update: row,
        create: row,
      }),
    ),
  );

  return NextResponse.json({ ok: true });
}
