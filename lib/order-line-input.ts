export interface OrderLineQuantityInput {
  quantityOrdered: number;
}

export type ParseResult =
  | { ok: true; data: OrderLineQuantityInput }
  | { ok: false; error: string };

export function parseOrderLineQuantityInput(body: unknown): ParseResult {
  const b = (body ?? {}) as Record<string, unknown>;
  const quantityOrdered = typeof b.quantityOrdered === "number" ? b.quantityOrdered : NaN;
  if (!Number.isInteger(quantityOrdered) || quantityOrdered <= 0) {
    return { ok: false, error: "quantityOrdered must be a positive whole number" };
  }
  return { ok: true, data: { quantityOrdered } };
}
