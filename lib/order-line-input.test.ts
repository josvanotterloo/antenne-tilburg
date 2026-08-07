// @vitest-environment node
import { describe, it, expect } from "vitest";

import { parseOrderLineQuantityInput } from "@/lib/order-line-input";

describe("parseOrderLineQuantityInput", () => {
  it("accepts a positive integer", () => {
    expect(parseOrderLineQuantityInput({ quantityOrdered: 5 })).toEqual({
      ok: true,
      data: { quantityOrdered: 5 },
    });
  });

  it("rejects zero, negative, non-integer, and missing values", () => {
    for (const bad of [{ quantityOrdered: 0 }, { quantityOrdered: -1 }, { quantityOrdered: 1.5 }, {}]) {
      expect(parseOrderLineQuantityInput(bad)).toEqual({
        ok: false,
        error: "quantityOrdered must be a positive whole number",
      });
    }
  });
});
