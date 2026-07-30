export interface SupplierInput {
  name: string;
  contact: string | null;
}

export type ParseResult = { ok: true; data: SupplierInput } | { ok: false; error: string };

export function parseSupplierInput(body: unknown): ParseResult {
  const b = (body ?? {}) as Record<string, unknown>;
  const name = typeof b.name === "string" ? b.name.trim() : "";
  if (!name) return { ok: false, error: "Name is required" };
  const contact = typeof b.contact === "string" ? b.contact.trim() : "";
  return { ok: true, data: { name, contact: contact || null } };
}
