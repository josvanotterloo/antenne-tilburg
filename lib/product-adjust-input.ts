export interface AdjustInput {
  delta: number;
  note: string | null;
}

export type ParseResult = { ok: true; data: AdjustInput } | { ok: false; error: string };

// No reason is required (per spec-admin-stock-artist.md A2) — note is purely
// optional free text, nullified when blank or absent.
export function parseAdjustInput(body: unknown): ParseResult {
  const b = (body ?? {}) as Record<string, unknown>;

  const delta = typeof b.delta === "number" ? b.delta : NaN;
  if (!Number.isInteger(delta) || delta === 0) {
    return { ok: false, error: "Delta must be a non-zero whole number" };
  }

  const note = typeof b.note === "string" ? b.note.trim() : "";

  return { ok: true, data: { delta, note: note || null } };
}
