import { describe, it, expect } from "vitest";

import { parseSupplyOrderInput } from "@/lib/supply-order-input";

const VALID = {
  supplierId: "s1",
  reference: "PO-123",
  notes: "call ahead",
  orderedAt: "2026-07-29T10:00",
  lines: [{ productId: "p1", quantityOrdered: 5 }],
};

describe("parseSupplyOrderInput", () => {
  it("accepts and normalizes valid input", () => {
    const result = parseSupplyOrderInput(VALID);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.supplierId).toBe("s1");
    expect(result.data.reference).toBe("PO-123");
    expect(result.data.lines).toEqual([{ productId: "p1", quantityOrdered: 5 }]);
  });

  it("defaults orderedAt to now when absent", () => {
    const { orderedAt, ...rest } = VALID;
    void orderedAt;
    const result = parseSupplyOrderInput(rest);
    expect(result.ok).toBe(true);
  });

  it("nullifies blank reference/notes", () => {
    const result = parseSupplyOrderInput({ ...VALID, reference: "", notes: "  " });
    expect(result.ok && result.data.reference).toBeNull();
    expect(result.ok && result.data.notes).toBeNull();
  });

  it("rejects a missing supplierId", () => {
    expect(parseSupplyOrderInput({ ...VALID, supplierId: "" }).ok).toBe(false);
  });

  it("rejects an empty lines array", () => {
    expect(parseSupplyOrderInput({ ...VALID, lines: [] }).ok).toBe(false);
  });

  it("rejects a line with a non-positive quantity", () => {
    expect(parseSupplyOrderInput({ ...VALID, lines: [{ productId: "p1", quantityOrdered: 0 }] }).ok).toBe(false);
    expect(parseSupplyOrderInput({ ...VALID, lines: [{ productId: "p1", quantityOrdered: -1 }] }).ok).toBe(false);
  });

  it("rejects a duplicate product across lines", () => {
    const result = parseSupplyOrderInput({
      ...VALID,
      lines: [
        { productId: "p1", quantityOrdered: 1 },
        { productId: "p1", quantityOrdered: 2 },
      ],
    });
    expect(result.ok).toBe(false);
  });

  it("rejects an invalid orderedAt", () => {
    expect(parseSupplyOrderInput({ ...VALID, orderedAt: "not-a-date" }).ok).toBe(false);
  });
});
