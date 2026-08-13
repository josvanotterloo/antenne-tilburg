import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { assertEmailCryptoConfigured, decryptEmail } from "@/lib/email-crypto";
import { sendEmail } from "@/lib/email/send";
import { renderConfirmEmail } from "@/lib/email/confirm";
import { CONFIRM_WINDOW_MS } from "@/lib/newsletter-confirm-window";

const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

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
    let sent = false;
    try {
      const confirmUrl = `${baseUrl}/api/newsletter/confirm?token=${subscriber.confirmToken}`;
      await sendEmail({
        to: decryptEmail(subscriber.email),
        subject: "Confirm your Antenne Tilburg subscription",
        html: renderConfirmEmail({ confirmUrl }),
      });
      sent = true;
      succeeded += 1;
    } catch (error) {
      // Log the id, not the address — emails are PII and must stay out of logs.
      console.error("retry-pending: send failed for subscriber", subscriber.id, error);
      failed += 1;
    }

    if (sent) {
      // The email is what the admin/subscriber actually cares about — count
      // it succeeded even if this write fails. If it does fail, the row
      // stays eligible and may get re-sent next time; there's no way to
      // atomically guarantee both the send and this write together without
      // infrastructure well beyond what a manual admin retry needs.
      try {
        await db.newsletterSubscriber.update({
          where: { id: subscriber.id },
          data: { confirmEmailSentAt: new Date() },
        });
      } catch (error) {
        console.error(
          "retry-pending: sent but failed to record confirmEmailSentAt for subscriber",
          subscriber.id,
          error,
        );
      }
    }
  }

  return NextResponse.json({ tried: pending.length, succeeded, failed });
}
