// Validation for admin account changes (email + password).

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const MIN_PASSWORD = 8;

export type EmailResult =
  | { ok: true; data: { email: string } }
  | { ok: false; error: string };

export function parseEmailChange(body: unknown): EmailResult {
  const raw = (body as { email?: unknown } | null)?.email;
  const email = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (!email || !EMAIL_RE.test(email)) {
    return { ok: false, error: "A valid email is required" };
  }
  return { ok: true, data: { email } };
}

export type PasswordResult =
  | { ok: true; data: { currentPassword: string; newPassword: string } }
  | { ok: false; error: string };

export function parsePasswordChange(body: unknown): PasswordResult {
  const b = (body ?? {}) as Record<string, unknown>;
  // Passwords are not trimmed — leading/trailing spaces may be intentional.
  const currentPassword =
    typeof b.currentPassword === "string" ? b.currentPassword : "";
  const newPassword = typeof b.newPassword === "string" ? b.newPassword : "";

  if (!currentPassword) {
    return { ok: false, error: "Current password is required" };
  }
  if (newPassword.length < MIN_PASSWORD) {
    return {
      ok: false,
      error: `New password must be at least ${MIN_PASSWORD} characters`,
    };
  }
  return { ok: true, data: { currentPassword, newPassword } };
}
