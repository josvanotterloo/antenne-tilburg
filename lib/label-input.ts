export interface LabelInput {
  name: string;
  supplierId: string | null;
}

export type ParseResult = { ok: true; data: LabelInput } | { ok: false; error: string };

export function parseLabelInput(body: unknown): ParseResult {
  const b = (body ?? {}) as Record<string, unknown>;
  const name = typeof b.name === "string" ? b.name.trim() : "";
  if (!name) return { ok: false, error: "Name is required" };
  const supplierId = typeof b.supplierId === "string" ? b.supplierId.trim() : "";
  return { ok: true, data: { name, supplierId: supplierId || null } };
}
