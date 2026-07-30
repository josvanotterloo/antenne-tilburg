export interface SupplyOrderLineInput {
  productId: string;
  quantityOrdered: number;
}

export interface SupplyOrderInput {
  supplierId: string;
  reference: string | null;
  notes: string | null;
  orderedAt: string;
  lines: SupplyOrderLineInput[];
}

export type ParseResult = { ok: true; data: SupplyOrderInput } | { ok: false; error: string };

// A product can only appear once per order (mirrors the schema's
// @@unique([supplyOrderId, productId])) — ordering more later means a new
// line on a still-editable PENDING order, or a new order.
function parseLines(v: unknown): SupplyOrderLineInput[] | null {
  if (!Array.isArray(v) || v.length === 0) return null;
  const lines: SupplyOrderLineInput[] = [];
  const seen = new Set<string>();
  for (const item of v) {
    const l = (item ?? {}) as Record<string, unknown>;
    const productId = typeof l.productId === "string" ? l.productId.trim() : "";
    if (!productId || seen.has(productId)) return null;
    seen.add(productId);
    const qty = typeof l.quantityOrdered === "number" ? l.quantityOrdered : NaN;
    if (!Number.isInteger(qty) || qty <= 0) return null;
    lines.push({ productId, quantityOrdered: qty });
  }
  return lines;
}

export function parseSupplyOrderInput(body: unknown): ParseResult {
  const b = (body ?? {}) as Record<string, unknown>;

  const supplierId = typeof b.supplierId === "string" ? b.supplierId.trim() : "";
  if (!supplierId) return { ok: false, error: "Supplier is required" };

  const lines = parseLines(b.lines);
  if (!lines) {
    return {
      ok: false,
      error: "At least one order line with a valid, non-duplicate product and a positive quantity is required",
    };
  }

  const orderedAtRaw = typeof b.orderedAt === "string" ? b.orderedAt.trim() : "";
  const orderedAt = orderedAtRaw ? new Date(orderedAtRaw) : new Date();
  if (Number.isNaN(orderedAt.getTime())) {
    return { ok: false, error: "Ordered date is invalid" };
  }

  const reference = typeof b.reference === "string" ? b.reference.trim() : "";
  const notes = typeof b.notes === "string" ? b.notes.trim() : "";

  return {
    ok: true,
    data: {
      supplierId,
      reference: reference || null,
      notes: notes || null,
      orderedAt: orderedAt.toISOString(),
      lines,
    },
  };
}
