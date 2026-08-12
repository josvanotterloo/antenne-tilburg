import { Resend } from "resend";

import { withTimeout } from "@/lib/with-timeout";

const RESEND_TIMEOUT_MS = 10_000;

// Thin wrapper over Resend. Throws on a missing config, a send error, or a timeout
// so callers decide how to surface it. Mocked in tests — the suite never sends real email.
//
// The timeout only stops this function from hanging its caller — Resend's SDK
// doesn't accept an AbortSignal, so the underlying HTTP request isn't actually
// cancelled and may still complete after we've given up on it.
export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.NEWSLETTER_FROM;
  if (!apiKey || !from) {
    throw new Error(
      "RESEND_API_KEY and NEWSLETTER_FROM must be set to send email",
    );
  }

  const resend = new Resend(apiKey);
  const { error } = await withTimeout(
    () => resend.emails.send({ from, to, subject, html }),
    RESEND_TIMEOUT_MS,
    `Resend API timeout after ${RESEND_TIMEOUT_MS / 1000}s`,
  );
  if (error) {
    throw new Error(`Resend send failed: ${error.message ?? "unknown error"}`);
  }
}
