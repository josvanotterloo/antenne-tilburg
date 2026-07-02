// @vitest-environment node
import { describe, it, expect } from "vitest";

import { parseProductInput } from "@/lib/product-input";

const VALID = {
  artist: "  Vril  ",
  title: "Torus",
  catalogNumber: "ZR-001",
  labelId: "l1",
  genreId: "g1",
  productTypeId: "t1",
  condition: "NEW",
  price: "24.99",
  description: "  hypnotic  ",
  inStock: true,
};

describe("parseProductInput", () => {
  it("accepts and normalizes valid input", () => {
    const result = parseProductInput(VALID);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toMatchObject({
      artist: "Vril", // trimmed
      title: "Torus",
      catalogNumber: "ZR-001",
      labelId: "l1",
      genreId: "g1",
      productTypeId: "t1",
      condition: "NEW",
      price: "24.99",
      description: "hypnotic", // trimmed
      inStock: true,
    });
  });

  it("defaults inStock to true and nullifies blank optionals", () => {
    const result = parseProductInput({
      ...VALID,
      catalogNumber: "",
      description: "  ",
      inStock: undefined,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.catalogNumber).toBeNull();
    expect(result.data.description).toBeNull();
    expect(result.data.inStock).toBe(true);
  });

  it("respects inStock=false", () => {
    const result = parseProductInput({ ...VALID, inStock: false });
    expect(result.ok && result.data.inStock).toBe(false);
  });

  it.each([
    ["artist", { ...VALID, artist: "  " }],
    ["title", { ...VALID, title: "" }],
    ["labelId", { ...VALID, labelId: "" }],
    ["genreId", { ...VALID, genreId: "" }],
    ["productTypeId", { ...VALID, productTypeId: "" }],
  ])("rejects missing %s", (_field, body) => {
    expect(parseProductInput(body).ok).toBe(false);
  });

  it("rejects an invalid condition", () => {
    expect(parseProductInput({ ...VALID, condition: "USED" }).ok).toBe(false);
  });

  it.each([
    ["negative", "-1"],
    ["non-numeric", "abc"],
    ["empty", ""],
  ])("rejects %s price", (_label, price) => {
    expect(parseProductInput({ ...VALID, price }).ok).toBe(false);
  });

  it("accepts a numeric price and stringifies it", () => {
    const result = parseProductInput({ ...VALID, price: 8.5 });
    expect(result.ok && result.data.price).toBe("8.5");
  });
});
