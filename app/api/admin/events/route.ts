import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { parseEventInput, eventStatus } from "@/lib/event-input";

function isUniqueViolation(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === "P2002";
}

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  const events = await db.event.findMany({ orderBy: { date: "desc" } });
  return NextResponse.json(events);
}

export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const parsed = parseEventInput(await req.json().catch(() => null));
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const created = await db.event.create({
      data: { ...parsed.data, status: eventStatus(parsed.data.date) },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return NextResponse.json(
        { error: `Slug "${parsed.data.slug}" already exists` },
        { status: 409 },
      );
    }
    throw error;
  }
}
