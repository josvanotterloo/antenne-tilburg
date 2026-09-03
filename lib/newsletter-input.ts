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

// Unicode bidi-control and zero-width formatting characters. Outside the
// ASCII range above, so the C0 strip alone doesn't catch them, but the same
// reasoning applies: RIGHT-TO-LEFT OVERRIDE (U+202E) can visually reverse or
// spoof how a name renders ("Trojan Source"-style spoofing), and zero-width
// characters are invisible but still stored. ZWNJ/ZWJ (U+200C/U+200D) are
// deliberately excluded — they have legitimate use in some scripts and emoji
// sequences, unlike the rest of this set.
const BIDI_AND_INVISIBLE_CHARS =
  /[\u200B\u200E\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g;

function stripControlChars(s: string): string {
  return s.replace(CONTROL_CHARS, "").replace(BIDI_AND_INVISIBLE_CHARS, "");
}

export type NewsletterResult =
  | { ok: true; data: { name: string | null; email: string } }
  | { ok: false; error: string };

// Name is optional: the footer's email-only signup form never sends one, while
// the dedicated /newsletter page still collects it when the subscriber offers
// it. An empty/whitespace-only/control-chars-only name is stored as null, not
// an empty string, so the admin subscriber list can tell "no name given" apart
// from a name that happened to be blank.
export function parseNewsletterInput(body: unknown): NewsletterResult {
  const b = (body ?? {}) as Record<string, unknown>;
  const rawName =
    typeof b.name === "string" ? stripControlChars(b.name).trim() : "";
  const email =
    typeof b.email === "string"
      ? stripControlChars(b.email).trim().toLowerCase()
      : "";

  if (rawName.length > MAX_NAME) {
    return { ok: false, error: "That name is too long" };
  }
  if (!email || !EMAIL_RE.test(email)) {
    return { ok: false, error: "A valid email is required" };
  }
  if (email.length > MAX_EMAIL) {
    return { ok: false, error: "That email address is too long" };
  }
  return { ok: true, data: { name: rawName || null, email } };
}
