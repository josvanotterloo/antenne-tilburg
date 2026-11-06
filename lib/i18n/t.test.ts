import { describe, it, expect } from "vitest";
import { t, tCount } from "./t";
import en from "./en.json";

describe("t", () => {
  it("returns the Dutch string for a known key when locale is NL", () => {
    expect(t("common.save", "NL")).toBe("Opslaan");
  });

  it("returns the English string when locale is EN", () => {
    expect(t("common.save", "EN")).toBe("Save");
  });

  it("falls back to English when the key is missing from nl.json", () => {
    expect(t("test.fallbackOnly", "NL")).toBe(
      (en as Record<string, string>)["test.fallbackOnly"],
    );
  });
});

describe("tCount", () => {
  it("picks the singular key only for exactly 1, in Dutch", () => {
    expect(tCount(0, "products.countSingular", "products.countPlural", "NL")).toBe(
      "producten",
    );
    expect(tCount(1, "products.countSingular", "products.countPlural", "NL")).toBe(
      "product",
    );
    expect(tCount(2, "products.countSingular", "products.countPlural", "NL")).toBe(
      "producten",
    );
  });

  it("picks the singular key only for exactly 1, in English", () => {
    expect(tCount(0, "products.countSingular", "products.countPlural", "EN")).toBe(
      "products",
    );
    expect(tCount(1, "products.countSingular", "products.countPlural", "EN")).toBe(
      "product",
    );
    expect(tCount(2, "products.countSingular", "products.countPlural", "EN")).toBe(
      "products",
    );
  });
});
