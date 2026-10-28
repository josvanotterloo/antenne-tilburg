import { Resend } from "resend";

import { getRequestId } from "@/lib/log/context";
import { logEvent } from "@/lib/log/log";
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
  kind,
}: {
  to: string;
  subject: string;
  html: string;
  // A short label for the event taxonomy (e.g. "confirmation", "newsletter")
  // — never the recipient or subject line.
  kind: string;
}): Promise<void> {
  const start = Date.now();
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.NEWSLETTER_FROM;
  if (!apiKey || !from) {
    logEvent({
      event: "email.send",
      requestId: getRequestId(),
      outcome: "failed",
      kind,
    });
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
    logEvent({
      event: "email.send",
      requestId: getRequestId(),
      outcome: "failed",
      kind,
      durationMs: Date.now() - start,
    });
    throw new Error(`Resend send failed: ${error.message ?? "unknown error"}`);
  }
  logEvent({
    event: "email.send",
    requestId: getRequestId(),
    outcome: "ok",
    kind,
    durationMs: Date.now() - start,
  });
}
