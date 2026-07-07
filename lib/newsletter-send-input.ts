// Validation for composing a newsletter send (subject + markdown body).

const MAX_SUBJECT = 150;

export type NewsletterSendResult =
  | { ok: true; data: { subject: string; body: string } }
  | { ok: false; error: string };

export function parseNewsletterSendInput(input: unknown): NewsletterSendResult {
  const b = (input ?? {}) as Record<string, unknown>;
  const subject = typeof b.subject === "string" ? b.subject.trim() : "";
  const body = typeof b.body === "string" ? b.body.trim() : "";

  if (!subject) {
    return { ok: false, error: "A subject is required" };
  }
  if (subject.length > MAX_SUBJECT) {
    return { ok: false, error: "That subject is too long" };
  }
  if (!body) {
    return { ok: false, error: "A message body is required" };
  }
  return { ok: true, data: { subject, body } };
}
