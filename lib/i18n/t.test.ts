import { describe, it, expect } from "vitest";
import { t } from "./t";
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
