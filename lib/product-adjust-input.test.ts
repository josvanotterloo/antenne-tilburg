import { describe, it, expect } from "vitest";

import { parseAdjustInput } from "@/lib/product-adjust-input";

describe("parseAdjustInput", () => {
  it("accepts a positive delta with a reason", () => {
    const result = parseAdjustInput({ delta: 5, note: "found a missing box" });
    expect(result).toEqual({ ok: true, data: { delta: 5, note: "found a missing box" } });
  });

  it("accepts a negative delta", () => {
    const result = parseAdjustInput({ delta: -3, note: "damaged" });
    expect(result.ok && result.data.delta).toBe(-3);
  });

  it("trims the note", () => {
    const result = parseAdjustInput({ delta: 1, note: "  recount  " });
    expect(result.ok && result.data.note).toBe("recount");
  });

  it("rejects a zero delta", () => {
    expect(parseAdjustInput({ delta: 0, note: "x" }).ok).toBe(false);
  });

  it("rejects a non-integer delta", () => {
    expect(parseAdjustInput({ delta: 1.5, note: "x" }).ok).toBe(false);
  });

  it("rejects a missing or blank note", () => {
    expect(parseAdjustInput({ delta: 1 }).ok).toBe(false);
    expect(parseAdjustInput({ delta: 1, note: "   " }).ok).toBe(false);
  });
});
