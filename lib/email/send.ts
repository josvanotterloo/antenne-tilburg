import { Resend } from "resend";

// Thin wrapper over Resend. Throws on a missing config or a send error so callers
// decide how to surface it. Mocked in tests — the suite never sends real email.
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
  const { error } = await resend.emails.send({ from, to, subject, html });
  if (error) {
    throw new Error(`Resend send failed: ${error.message ?? "unknown error"}`);
  }
}
