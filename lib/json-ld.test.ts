import { describe, it, expect } from "vitest";

import { serializeJsonLd } from "@/lib/json-ld";

describe("serializeJsonLd", () => {
  it("serializes plain data to JSON", () => {
    expect(JSON.parse(serializeJsonLd({ a: 1, b: "x" }))).toEqual({
      a: 1,
      b: "x",
    });
  });

  it("escapes '<' so embedded content can't close the surrounding script tag", () => {
    const out = serializeJsonLd({
      description: "</script><script>alert(1)</script>",
    });
    expect(out).not.toContain("<");
    expect(JSON.parse(out).description).toBe(
      "</script><script>alert(1)</script>",
    );
  });
});
