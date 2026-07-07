import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { parseNewsletterSendInput } from "@/lib/newsletter-send-input";
import { sendEmail } from "@/lib/email/send";
import { renderNewsletterEmail } from "@/lib/email/render";

const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

// Admin-only: render the composed newsletter and send it to every CONFIRMED
// subscriber, each with their own unsubscribe link. Per-recipient failures are
// counted, not fatal.
export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const parsed = parseNewsletterSendInput(await req.json().catch(() => null));
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const subscribers = await db.newsletterSubscriber.findMany({
    where: { status: "CONFIRMED" },
  });

  let sent = 0;
  let failed = 0;
  for (const subscriber of subscribers) {
    const unsubscribeUrl = `${baseUrl}/api/newsletter/unsubscribe?token=${subscriber.confirmToken}`;
    try {
      await sendEmail({
        to: subscriber.email,
        subject: parsed.data.subject,
        html: renderNewsletterEmail({
          subject: parsed.data.subject,
          body: parsed.data.body,
          unsubscribeUrl,
        }),
      });
      sent += 1;
    } catch (error) {
      console.error("newsletter send failed for", subscriber.email, error);
      failed += 1;
    }
  }

  return NextResponse.json({ ok: true, sent, failed });
}
