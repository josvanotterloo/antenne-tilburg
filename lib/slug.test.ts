// @vitest-environment node
import { describe, it, expect } from "vitest";

import { slugify } from "@/lib/slug";

describe("slugify", () => {
  it("lowercases and hyphenates words", () => {
    expect(slugify("Hello World")).toBe("hello-world");
  });

  it("strips diacritics", () => {
    expect(slugify("Café Déjà Vu")).toBe("cafe-deja-vu");
  });

  it("collapses whitespace and punctuation runs", () => {
    expect(slugify("  Multiple   Spaces  ")).toBe("multiple-spaces");
    expect(slugify("Special!@#Chars")).toBe("special-chars");
  });

  it("trims leading/trailing separators and handles empty input", () => {
    expect(slugify("--Rush Hour--")).toBe("rush-hour");
    expect(slugify("")).toBe("");
    expect(slugify("!!!")).toBe("");
  });
});
