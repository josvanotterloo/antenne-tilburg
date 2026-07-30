export interface AdjustInput {
  delta: number;
  note: string;
}

export type ParseResult = { ok: true; data: AdjustInput } | { ok: false; error: string };

// Unlike sell-one/receive (whose amount and context are implicit in the
// action), a manual adjustment has no other record of "why" — the note is
// required so the ledger stays self-explanatory.
export function parseAdjustInput(body: unknown): ParseResult {
  const b = (body ?? {}) as Record<string, unknown>;

  const delta = typeof b.delta === "number" ? b.delta : NaN;
  if (!Number.isInteger(delta) || delta === 0) {
    return { ok: false, error: "Delta must be a non-zero whole number" };
  }

  const note = typeof b.note === "string" ? b.note.trim() : "";
  if (!note) {
    return { ok: false, error: "A reason is required" };
  }

  return { ok: true, data: { delta, note } };
}
