import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";

// The NewsletterTemplate singleton: the reusable header/footer that
// pre-populates the composer. One row, fixed id, upsert on save.
const SINGLETON = "singleton";

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  const template = await db.newsletterTemplate.findUnique({
    where: { id: SINGLETON },
  });
  return NextResponse.json({
    headerText: template?.headerText ?? "",
    footerText: template?.footerText ?? "",
    updatedAt: template?.updatedAt ?? null,
  });
}

export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const body = (await req.json().catch(() => null)) as {
    headerText?: unknown;
    footerText?: unknown;
  } | null;
  if (
    typeof body?.headerText !== "string" ||
    typeof body?.footerText !== "string"
  ) {
    return NextResponse.json(
      { error: "headerText and footerText must be strings" },
      { status: 400 },
    );
  }

  const saved = await db.newsletterTemplate.upsert({
    where: { id: SINGLETON },
    create: {
      id: SINGLETON,
      headerText: body.headerText,
      footerText: body.footerText,
    },
    update: { headerText: body.headerText, footerText: body.footerText },
  });
  return NextResponse.json({
    headerText: saved.headerText,
    footerText: saved.footerText,
  });
}
