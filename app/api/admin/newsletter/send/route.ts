import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { assertEmailCryptoConfigured, decryptEmail } from "@/lib/email-crypto";
import { parseNewsletterSendInput } from "@/lib/newsletter-send-input";
import { sendEmail } from "@/lib/email/send";
import { renderStructuredNewsletterEmail } from "@/lib/email/render";
import { shopDayRange } from "@/lib/catalog";
import { getNewArrivals } from "@/lib/newsletter-arrivals";

const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

// Admin-only: assemble the structured newsletter (header md + new arrivals in
// the date range + footer md) server-side and send it to every CONFIRMED
// subscriber, each with their own unsubscribe link. The header/footer are
// persisted to the NewsletterTemplate singleton on every send, so the next
// newsletter starts pre-filled; per-recipient failures are counted, not fatal.
export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const parsed = parseNewsletterSendInput(await req.json().catch(() => null));
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const range = shopDayRange(parsed.data.from, parsed.data.to);
  if (!range) {
    return NextResponse.json(
      { error: "The arrivals date range is invalid" },
      { status: 400 },
    );
  }

  // Preflight the key before the loop: a misconfigured key would otherwise be
  // swallowed as N per-recipient failures and reported as 200 {ok, sent: 0}.
  try {
    assertEmailCryptoConfigured();
  } catch (error) {
    console.error("newsletter send blocked: encryption key misconfigured", error);
    return NextResponse.json(
      { error: "EMAIL_ENCRYPTION_KEY is missing or invalid on the server." },
      { status: 500 },
    );
  }

  const arrivals = await getNewArrivals(range);

  // Remember the header/footer for next time; updatedAt records the last use.
  await db.newsletterTemplate.upsert({
    where: { id: "singleton" },
    create: {
      id: "singleton",
      headerText: parsed.data.header,
      footerText: parsed.data.footer,
    },
    update: {
      headerText: parsed.data.header,
      footerText: parsed.data.footer,
    },
  });

  const subscribers = await db.newsletterSubscriber.findMany({
    where: { status: "CONFIRMED" },
  });

  let sent = 0;
  let failed = 0;
  for (const subscriber of subscribers) {
    const unsubscribeUrl = `${baseUrl}/api/newsletter/unsubscribe?token=${subscriber.confirmToken}`;
    try {
      await sendEmail({
        // Addresses are stored encrypted (lib/email-crypto.ts); decrypt per
        // recipient for delivery only.
        to: decryptEmail(subscriber.email),
        subject: parsed.data.subject,
        html: renderStructuredNewsletterEmail({
          subject: parsed.data.subject,
          header: parsed.data.header,
          arrivals,
          footer: parsed.data.footer,
          unsubscribeUrl,
        }),
      });
      sent += 1;
    } catch (error) {
      // Log the id, not the address — emails are PII and must stay out of logs.
      console.error("newsletter send failed for subscriber", subscriber.id, error);
      failed += 1;
    }
  }

  return NextResponse.json({ ok: true, sent, failed });
}
