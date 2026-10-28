// Same detection-logic pattern as lib/sentry-scrub.ts's EMAIL_PATTERN, kept
// as its own copy scoped to this module's input shapes (small strings we log
// verbatim) rather than shared code with Sentry's event-shaped scrubber.
const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_PATTERN = /(?:\+?\d[\d\s().-]{7,}\d)/g;

// For genuinely freeform input (search queries, order notes): never log the
// content, only its length. This is the safe default for anything that
// can't be structurally verified PII-free.
export function redactFreeText(value: string): { length: number } {
  return { length: value.length };
}

// For a field that's logged verbatim (e.g. a short `reason` string) but
// might incidentally contain an email- or phone-shaped substring: strip it
// mechanically rather than trust the call site never to pass one through.
export function redactKnownPatterns(value: string): string {
  return value.replace(EMAIL_PATTERN, "[redacted-email]").replace(PHONE_PATTERN, "[redacted-phone]");
}
