// Validation for composing a structured newsletter send: subject, the
// header/footer markdown (may be empty — the template starts unset) and the
// new-arrivals date range. Range *format* is validated here; calendar
// validity (reversed range etc.) is the route's job via shopDayRange.

const MAX_SUBJECT = 150;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export interface NewsletterSendData {
  subject: string;
  header: string;
  footer: string;
  from: string;
  to: string;
}

export type NewsletterSendResult =
  | { ok: true; data: NewsletterSendData }
  | { ok: false; error: string };

export function parseNewsletterSendInput(input: unknown): NewsletterSendResult {
  const b = (input ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

  const subject = str(b.subject);
  if (!subject) {
    return { ok: false, error: "A subject is required" };
  }
  if (subject.length > MAX_SUBJECT) {
    return { ok: false, error: "That subject is too long" };
  }

  const from = str(b.from);
  const to = str(b.to);
  if (!ISO_DATE.test(from) || !ISO_DATE.test(to)) {
    return { ok: false, error: "A valid arrivals date range is required" };
  }

  return {
    ok: true,
    data: { subject, header: str(b.header), footer: str(b.footer), from, to },
  };
}
