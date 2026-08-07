// @vitest-environment node
import { describe, it, expect } from "vitest";

import { parseLabelInput } from "@/lib/label-input";

describe("parseLabelInput", () => {
  it("accepts a name with no supplier", () => {
    expect(parseLabelInput({ name: "Warp" })).toEqual({
      ok: true,
      data: { name: "Warp", supplierId: null },
    });
  });

  it("accepts a name with a supplierId", () => {
    expect(parseLabelInput({ name: "Warp", supplierId: "s1" })).toEqual({
      ok: true,
      data: { name: "Warp", supplierId: "s1" },
    });
  });

  it("rejects a blank name", () => {
    expect(parseLabelInput({ name: "  " })).toEqual({
      ok: false,
      error: "Name is required",
    });
  });

  it("treats a blank supplierId as null", () => {
    expect(parseLabelInput({ name: "Warp", supplierId: "  " })).toEqual({
      ok: true,
      data: { name: "Warp", supplierId: null },
    });
  });
});
