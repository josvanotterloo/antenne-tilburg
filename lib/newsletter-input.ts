// Validation for the public newsletter signup (name + email).

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const MAX_NAME = 100;

export type NewsletterResult =
  | { ok: true; data: { name: string; email: string } }
  | { ok: false; error: string };

export function parseNewsletterInput(body: unknown): NewsletterResult {
  const b = (body ?? {}) as Record<string, unknown>;
  const name = typeof b.name === "string" ? b.name.trim() : "";
  const email =
    typeof b.email === "string" ? b.email.trim().toLowerCase() : "";

  if (!name) {
    return { ok: false, error: "Your name is required" };
  }
  if (name.length > MAX_NAME) {
    return { ok: false, error: "That name is too long" };
  }
  if (!email || !EMAIL_RE.test(email)) {
    return { ok: false, error: "A valid email is required" };
  }
  return { ok: true, data: { name, email } };
}
