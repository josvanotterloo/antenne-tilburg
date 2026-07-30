// lib/supply-order-receive-input.test.ts
import { describe, it, expect } from "vitest";

import { parseReceiveInput } from "@/lib/supply-order-receive-input";

describe("parseReceiveInput", () => {
  it("accepts one or more lines", () => {
    const result = parseReceiveInput({ lines: [{ supplyOrderLineId: "l1", receiveNow: 3 }] });
    expect(result).toEqual({ ok: true, data: { lines: [{ supplyOrderLineId: "l1", receiveNow: 3 }] } });
  });

  it("accepts receiveNow: 0 (caller filters no-ops, not the parser)", () => {
    const result = parseReceiveInput({ lines: [{ supplyOrderLineId: "l1", receiveNow: 0 }] });
    expect(result.ok).toBe(true);
  });

  it("rejects an empty lines array", () => {
    expect(parseReceiveInput({ lines: [] }).ok).toBe(false);
  });

  it("rejects a negative receiveNow", () => {
    expect(parseReceiveInput({ lines: [{ supplyOrderLineId: "l1", receiveNow: -1 }] }).ok).toBe(false);
  });

  it("rejects a non-integer receiveNow", () => {
    expect(parseReceiveInput({ lines: [{ supplyOrderLineId: "l1", receiveNow: 1.5 }] }).ok).toBe(false);
  });

  it("rejects a missing supplyOrderLineId", () => {
    expect(parseReceiveInput({ lines: [{ receiveNow: 1 }] }).ok).toBe(false);
  });
});
