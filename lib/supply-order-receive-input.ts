// lib/supply-order-receive-input.ts
export interface ReceiveLineInput {
  supplyOrderLineId: string;
  receiveNow: number;
}

export interface ReceiveInput {
  lines: ReceiveLineInput[];
}

export type ParseResult = { ok: true; data: ReceiveInput } | { ok: false; error: string };

// receiveNow is THIS event's increment, not a new total — avoids re-entering
// already-received counts on a second (partial) receive.
export function parseReceiveInput(body: unknown): ParseResult {
  const b = (body ?? {}) as Record<string, unknown>;
  if (!Array.isArray(b.lines) || b.lines.length === 0) {
    return { ok: false, error: "At least one line is required" };
  }
  const lines: ReceiveLineInput[] = [];
  for (const item of b.lines) {
    const l = (item ?? {}) as Record<string, unknown>;
    const supplyOrderLineId = typeof l.supplyOrderLineId === "string" ? l.supplyOrderLineId.trim() : "";
    if (!supplyOrderLineId) return { ok: false, error: "Each line needs a supplyOrderLineId" };
    const receiveNow = typeof l.receiveNow === "number" ? l.receiveNow : NaN;
    if (!Number.isInteger(receiveNow) || receiveNow < 0) {
      return { ok: false, error: "receiveNow must be a non-negative whole number" };
    }
    lines.push({ supplyOrderLineId, receiveNow });
  }
  return { ok: true, data: { lines } };
}
