import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { assertEmailCryptoConfigured, decryptEmail } from "@/lib/email-crypto";
import { sendEmail } from "@/lib/email/send";
import { renderConfirmEmail } from "@/lib/email/confirm";

const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
// Matches the confirm link's own expiry (app/api/newsletter/confirm/route.ts) —
// no point retrying a send whose link would already be expired on arrival.
const CONFIRM_WINDOW_MS = 48 * 60 * 60 * 1000;

// Manual trigger (admin clicks "Retry pending emails") for subscribers whose
// signup confirmation email never sent — e.g. Resend was down or timed out.
// Mirrors app/api/admin/newsletter/send/route.ts's guard/preflight/count
// pattern.
export async function POST() {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    assertEmailCryptoConfigured();
  } catch (error) {
    console.error("retry-pending blocked: encryption key misconfigured", error);
    return NextResponse.json(
      { error: "EMAIL_ENCRYPTION_KEY is missing or invalid on the server." },
      { status: 500 },
    );
  }

  const cutoff = new Date(Date.now() - CONFIRM_WINDOW_MS);
  const pending = await db.newsletterSubscriber.findMany({
    where: {
      status: "PENDING",
      confirmEmailSentAt: null,
      createdAt: { gt: cutoff },
    },
  });

  let succeeded = 0;
  let failed = 0;
  for (const subscriber of pending) {
    try {
      const confirmUrl = `${baseUrl}/api/newsletter/confirm?token=${subscriber.confirmToken}`;
      await sendEmail({
        to: decryptEmail(subscriber.email),
        subject: "Confirm your Antenne Tilburg subscription",
        html: renderConfirmEmail({ confirmUrl }),
      });
      await db.newsletterSubscriber.update({
        where: { id: subscriber.id },
        data: { confirmEmailSentAt: new Date() },
      });
      succeeded += 1;
    } catch (error) {
      // Log the id, not the address — emails are PII and must stay out of logs.
      console.error("retry-pending: send failed for subscriber", subscriber.id, error);
      failed += 1;
    }
  }

  return NextResponse.json({ tried: pending.length, succeeded, failed });
}
