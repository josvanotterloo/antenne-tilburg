import { NextResponse } from "next/server";

import { clientIp } from "@/lib/client-ip";
import { db } from "@/lib/db";
import { emailHash, encryptEmail } from "@/lib/email-crypto";
import { getRequestId, withRequestContext } from "@/lib/log/context";
import { logEvent } from "@/lib/log/log";
import { parseNewsletterInput } from "@/lib/newsletter-input";
import { prismaErrorResponse } from "@/lib/prisma-error";
import { newToken } from "@/lib/token";
import { sendEmail } from "@/lib/email/send";
import { renderConfirmEmail } from "@/lib/email/confirm";
import { newsletterSignupLimiter } from "@/lib/rate-limit";

const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

// Public newsletter signup (double opt-in). No auth: anyone may subscribe with a
// name + email, but they are created PENDING and must confirm via emailed link.
export async function POST(req: Request) {
  return withRequestContext(req, async () => postNewsletterSignup(req));
}

async function postNewsletterSignup(req: Request) {
  const parsed = parseNewsletterInput(await req.json().catch(() => null));
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  // Rate-limit by client IP: each signup sends a confirmation email, so an
  // unthrottled flood is a spam / Resend-cost vector. clientIp uses the
  // rightmost x-forwarded-for entry — the leftmost is client-spoofable.
  const ip = clientIp(req.headers);
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
    //
    // prismaErrorCode() duck-types (`.code === "P2002"`) rather than the
    // `error instanceof Prisma.PrismaClientKnownRequestError` check this
    // route had before — a precision loss /code-review flagged on this
    // public, non-enumerating endpoint. Not changed: every other route's
    // existing tests mock Prisma errors as plain `{code}` objects, not
    // real PrismaClientKnownRequestError instances, so an instanceof
    // check here (or centrally) would need either a repo-wide mocking
    // convention change (out of this task's scope and a Test Contract
    // risk) or a one-off special case for just this file (reintroducing
    // the inconsistency this module exists to remove). The only code this
    // try block can throw is from db.newsletterSubscriber.create, which
    // only ever throws real Prisma errors — not a reachable gap today.
    const response = prismaErrorResponse(error, {
      P2002: { status: 201, body: { ok: true } },
    });
    if (response) return response;
    console.error("newsletter subscribe failed", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }

  // Send the confirmation email. This is a best-effort side effect, not a
  // condition of signup succeeding: Resend has no cancellation on our timeout,
  // so a "failed" send may still land later, and deleting the row on any
  // failure would risk orphaning a confirmation link that does arrive. A
  // failed/timed-out send instead leaves confirmEmailSentAt null — the row
  // stays PENDING and the admin's retry queue
  // (POST /api/admin/newsletter/retry-pending) picks it up later.
  try {
    const confirmUrl = `${baseUrl}/api/newsletter/confirm?token=${confirmToken}`;
    await sendEmail({
      to: parsed.data.email,
      subject: "Confirm your Antenne Tilburg subscription",
      html: renderConfirmEmail({ confirmUrl }),
      kind: "confirmation",
    });
    await db.newsletterSubscriber.update({
      where: { id: subscriber.id },
      data: { confirmEmailSentAt: new Date() },
    });
    return NextResponse.json(
      { ok: true, message: "Check your email to confirm your subscription" },
      { status: 201 },
    );
  } catch (error) {
    console.error("newsletter confirm email failed (queued for retry)", subscriber.id, error);
    // Sentry never sees this: it's caught and the response below is still a
    // 201, so onRequestError's auto-capture (unhandled errors only) never
    // fires. Log-only fix (the swallowed-failure response itself, still
    // returning 201 here, is unrelated, out-of-scope behavior).
    logEvent({
      event: "error",
      requestId: getRequestId(),
      where: "app/api/newsletter/route.ts",
      errorKind: error instanceof Error ? error.constructor.name : "unknown",
    });
    return NextResponse.json(
      {
        ok: true,
        message:
          "You're on the list — we'll send your confirmation email shortly",
      },
      { status: 201 },
    );
  }
}
