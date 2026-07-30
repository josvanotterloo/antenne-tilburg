import { describe, it, expect } from "vitest";

import { parseSupplierInput } from "@/lib/supplier-input";

describe("parseSupplierInput", () => {
  it("accepts a name with optional contact, trimmed", () => {
    const result = parseSupplierInput({ name: "  Kalahari Oyster Cult  ", contact: " ask for Jules " });
    expect(result).toEqual({ ok: true, data: { name: "Kalahari Oyster Cult", contact: "ask for Jules" } });
  });

  it("nullifies a blank or absent contact", () => {
    expect(parseSupplierInput({ name: "X", contact: "" }).ok && (parseSupplierInput({ name: "X", contact: "" }) as { data: { contact: null } }).data.contact).toBeNull();
    const absent = parseSupplierInput({ name: "X" });
    expect(absent.ok && absent.data.contact).toBeNull();
  });

  it("rejects a blank name", () => {
    expect(parseSupplierInput({ name: "   " }).ok).toBe(false);
    expect(parseSupplierInput({}).ok).toBe(false);
  });
});
