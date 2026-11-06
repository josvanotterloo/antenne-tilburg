import type { AdminLocale } from "@prisma/client";
import { t, type TranslationKey } from "./t";

// Known, stable error strings returned by app/api/admin/users/[id]/route.ts
// and .../password/route.ts. An API message this doesn't recognize (a
// network/generic fallback from apiSend, or any other server string not
// listed here) passes through in English — see the Users close-out report.
const EXACT_MATCHES: Record<string, TranslationKey> = {
  "A valid email is required": "errors.invalidEmail",
  "That email is already in use": "errors.emailTaken",
  "Not found": "errors.notFound",
  "Current password is required": "errors.currentPasswordRequired",
  "Current password is incorrect": "errors.currentPasswordIncorrect",
};

// lib/user-input.ts builds this message from MIN_PASSWORD at runtime, so it
// can't be an exact-match dictionary entry — matched by pattern instead,
// carrying the number through unchanged.
const PASSWORD_LENGTH_RE = /^New password must be at least (\d+) characters$/;

export function mapApiError(message: string, locale: AdminLocale): string {
  const key = EXACT_MATCHES[message];
  if (key) return t(key, locale);

  const lengthMatch = message.match(PASSWORD_LENGTH_RE);
  if (lengthMatch) {
    return locale === "EN"
      ? message
      : `Nieuw wachtwoord moet minimaal ${lengthMatch[1]} tekens lang zijn`;
  }

  return message;
}
