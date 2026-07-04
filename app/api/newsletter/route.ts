import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { parseNewsletterInput } from "@/lib/newsletter-input";

// Public newsletter signup. No auth: anyone may subscribe with a name + email.
export async function POST(req: Request) {
  const parsed = parseNewsletterInput(await req.json().catch(() => null));
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    await db.newsletterSubscriber.create({ data: parsed.data });
  } catch (error) {
    // Duplicate email (unique constraint) → treat as success. This keeps signup
    // idempotent and avoids leaking whether an address is already subscribed.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json({ ok: true, alreadySubscribed: true });
    }
    console.error("newsletter subscribe failed", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
