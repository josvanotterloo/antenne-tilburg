// Validation/normalization for site notices.

export interface NoticeInput {
  message: string;
  active: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
}

export type ParseResult =
  | { ok: true; data: NoticeInput }
  | { ok: false; error: string };

function optionalDate(v: unknown): { ok: true; value: Date | null } | { ok: false } {
  const s = typeof v === "string" ? v.trim() : "";
  if (!s) return { ok: true, value: null };
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? { ok: false } : { ok: true, value: d };
}

export function parseNoticeInput(body: unknown): ParseResult {
  const b = (body ?? {}) as Record<string, unknown>;

  const message = typeof b.message === "string" ? b.message.trim() : "";
  if (!message) return { ok: false, error: "Message is required" };

  const startsAt = optionalDate(b.startsAt);
  if (!startsAt.ok) return { ok: false, error: "Invalid start date" };
  const endsAt = optionalDate(b.endsAt);
  if (!endsAt.ok) return { ok: false, error: "Invalid end date" };

  if (
    startsAt.value &&
    endsAt.value &&
    endsAt.value.getTime() < startsAt.value.getTime()
  ) {
    return { ok: false, error: "End must be after start" };
  }

  return {
    ok: true,
    data: {
      message,
      active: typeof b.active === "boolean" ? b.active : true,
      startsAt: startsAt.value,
      endsAt: endsAt.value,
    },
  };
}
