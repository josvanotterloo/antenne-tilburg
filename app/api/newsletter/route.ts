import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { emailHash, encryptEmail } from "@/lib/email-crypto";
import { parseNewsletterInput } from "@/lib/newsletter-input";
import { newToken } from "@/lib/token";
import { sendEmail } from "@/lib/email/send";
import { renderConfirmEmail } from "@/lib/email/confirm";
import { newsletterSignupLimiter } from "@/lib/rate-limit";

const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

// Public newsletter signup (double opt-in). No auth: anyone may subscribe with a
// name + email, but they are created PENDING and must confirm via emailed link.
export async function POST(req: Request) {
  const parsed = parseNewsletterInput(await req.json().catch(() => null));
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  // Rate-limit by client IP: each signup sends a confirmation email, so an
  // unthrottled flood is a spam / Resend-cost vector.
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!newsletterSignupLimiter.check(ip)) {
    return NextResponse.json(
      { error: "Too many signups from your network. Please try again later." },
      { status: 429 },
    );
  }

  // Duplicate check must also cover unmigrated legacy rows: their emailHash is
  // NULL, which the unique index never matches (NULL != NULL in Postgres), but
  // their email column still holds the plaintext address. Same silent 201 as
  // the P2002 path below — the response must not reveal the address is known.
  const hash = emailHash(parsed.data.email);
  const existing = await db.newsletterSubscriber.findFirst({
    where: { OR: [{ emailHash: hash }, { email: parsed.data.email }] },
  });
  if (existing) {
    return NextResponse.json({ ok: true }, { status: 201 });
  }

  const confirmToken = newToken();
  let subscriber: { id: string };
  try {
    // Email is stored encrypted (AES-256-GCM); the keyed hash column carries
    // the unique constraint for duplicate detection (see lib/email-crypto.ts).
    // P2002 below remains as the race backstop for concurrent signups.
    subscriber = await db.newsletterSubscriber.create({
      data: {
        name: parsed.data.name,
        email: encryptEmail(parsed.data.email),
        emailHash: hash,
        status: "PENDING",
        confirmToken,
      },
    });
  } catch (error) {
    // Duplicate email (unique emailHash constraint) → return the *same* 201 as a
    // fresh signup. Idempotent and non-enumerating: the response must not reveal
    // whether the address was already subscribed.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json({ ok: true }, { status: 201 });
    }
    console.error("newsletter subscribe failed", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }

  // Send the confirmation email. If it fails, roll back the row so a retry starts
  // clean (an orphaned PENDING row would collide on retry and never resend).
  try {
    const confirmUrl = `${baseUrl}/api/newsletter/confirm?token=${confirmToken}`;
    await sendEmail({
      to: parsed.data.email,
      subject: "Confirm your Antenne Tilburg subscription",
      html: renderConfirmEmail({ confirmUrl }),
    });
  } catch (error) {
    console.error("newsletter confirm email failed", error);
    await db.newsletterSubscriber
      .delete({ where: { id: subscriber.id } })
      .catch(() => {});
    return NextResponse.json(
      { error: "Could not send the confirmation email. Please try again." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
