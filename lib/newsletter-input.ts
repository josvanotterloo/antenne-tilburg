// Validation for the public newsletter signup (name + email).
//
// React escapes all string output by default, so XSS from these fields isn't
// a display-time concern. The reason to still restrict this input is that
// this app has no LLM-backed feature reading it today — but if one is ever
// added (e.g. an AI-assisted newsletter composer), raw user text must not be
// fed into a prompt unsanitized. See docs/security/prompt-injection-policy.md.
// If a future public field needs the same treatment (a notes/description
// field, say), reuse stripControlChars() and cap it at a sane max length
// (1000 chars for free text is a reasonable default) the same way as here.

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const MAX_NAME = 100;
const MAX_EMAIL = 254; // RFC 5321 §4.5.3.1.3

// C0 control characters except \t \n \r, plus DEL. Never legitimate in a
// name or email address; left uncaught they can cause rendering glitches in
// the admin subscriber table and CSV export (lib/csv.ts already handles
// spreadsheet formula injection separately).
const CONTROL_CHARS = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;

function stripControlChars(s: string): string {
  return s.replace(CONTROL_CHARS, "");
}

export type NewsletterResult =
  | { ok: true; data: { name: string; email: string } }
  | { ok: false; error: string };

export function parseNewsletterInput(body: unknown): NewsletterResult {
  const b = (body ?? {}) as Record<string, unknown>;
  const name =
    typeof b.name === "string" ? stripControlChars(b.name).trim() : "";
  const email =
    typeof b.email === "string"
      ? stripControlChars(b.email).trim().toLowerCase()
      : "";

  if (!name) {
    return { ok: false, error: "Your name is required" };
  }
  if (name.length > MAX_NAME) {
    return { ok: false, error: "That name is too long" };
  }
  if (!email || !EMAIL_RE.test(email)) {
    return { ok: false, error: "A valid email is required" };
  }
  if (email.length > MAX_EMAIL) {
    return { ok: false, error: "That email address is too long" };
  }
  return { ok: true, data: { name, email } };
}
