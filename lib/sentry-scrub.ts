import type { ErrorEvent } from "@sentry/nextjs";

const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

// Sentry's beforeSend hook. Strips email-shaped substrings from the whole
// serialized event (message, exception values, breadcrumbs, extra, etc.)
// rather than walking each field by hand — the event shape is large and
// mostly optional, and a substring redaction over the full JSON catches
// anywhere an address could end up without enumerating every field.
//
// Fails safe: if the event can't be round-tripped through JSON at all (e.g.
// a BigInt somewhere in extra data), the event is dropped rather than sent
// unscrubbed — losing an error report is preferable to risking a PII leak.
export function scrubEmails(event: ErrorEvent): ErrorEvent | null {
  try {
    const serialized = JSON.stringify(event);
    const redacted = serialized.replace(EMAIL_PATTERN, "[redacted-email]");
    return redacted === serialized ? event : (JSON.parse(redacted) as ErrorEvent);
  } catch {
    return null;
  }
}
