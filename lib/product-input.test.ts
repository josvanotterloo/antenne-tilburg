// @vitest-environment node
import { describe, it, expect } from "vitest";

import { parseProductInput, toProductData } from "@/lib/product-input";

const VALID = {
  artistIds: ["a1"],
  title: "Torus",
  catalogNumber: "ZR-001",
  labelId: "l1",
  genreId: "g1",
  productTypeId: "t1",
  condition: "NEW",
  price: "24.99",
  description: "  hypnotic  ",
  quantity: 1,
};

describe("parseProductInput", () => {
  it("accepts and normalizes valid input", () => {
    const result = parseProductInput(VALID);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toMatchObject({
      artistIds: ["a1"],
      title: "Torus",
      catalogNumber: "ZR-001",
      labelId: "l1",
      genreId: "g1",
      productTypeId: "t1",
      condition: "NEW",
      price: "24.99",
      description: "hypnotic", // trimmed
      quantity: 1,
    });
  });

  it("accepts a coverImage URL, trims it, and nullifies it when blank or absent", () => {
    const withImage = parseProductInput({
      ...VALID,
      coverImage: "  /uploads/cover.webp  ",
    });
    expect(withImage.ok && withImage.data.coverImage).toBe(
      "/uploads/cover.webp",
    );

    const blank = parseProductInput({ ...VALID, coverImage: "" });
    expect(blank.ok && blank.data.coverImage).toBeNull();

    const absent = parseProductInput(VALID);
    expect(absent.ok && absent.data.coverImage).toBeNull();
  });

  it("defaults quantity to 0 and nullifies blank optionals", () => {
    const result = parseProductInput({
      ...VALID,
      catalogNumber: "",
      description: "  ",
      quantity: undefined,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.catalogNumber).toBeNull();
    expect(result.data.description).toBeNull();
    expect(result.data.quantity).toBe(0);
  });

  it("accepts quantity as a number or a numeric string", () => {
    expect(
      parseProductInput({ ...VALID, quantity: 5 }).ok &&
        (parseProductInput({ ...VALID, quantity: 5 }) as { data: { quantity: number } }).data
          .quantity,
    ).toBe(5);
    const asString = parseProductInput({ ...VALID, quantity: "3" });
    expect(asString.ok && asString.data.quantity).toBe(3);
  });

  it.each([
    ["negative number", -1],
    ["non-integer number", 1.5],
    ["non-numeric string", "abc"],
    ["float string", "1.5"],
    ["hex string", "0x10"],
    ["exponent string", "1e3"],
    ["boolean", true],
  ])("rejects %s quantity", (_label, quantity) => {
    expect(parseProductInput({ ...VALID, quantity }).ok).toBe(false);
  });

  it.each([
    ["title", { ...VALID, title: "" }],
    ["labelId", { ...VALID, labelId: "" }],
    ["genreId", { ...VALID, genreId: "" }],
    ["productTypeId", { ...VALID, productTypeId: "" }],
  ])("rejects missing %s", (_field, body) => {
    expect(parseProductInput(body).ok).toBe(false);
  });

  it.each([
    ["empty array", []],
    ["not an array", "a1"],
    ["blank entry", ["a1", "   "]],
    ["non-string entry", ["a1", 2]],
  ])("rejects artistIds: %s", (_label, artistIds) => {
    expect(parseProductInput({ ...VALID, artistIds }).ok).toBe(false);
  });

  it("dedupes repeated artistIds, preserving first-seen order", () => {
    const result = parseProductInput({ ...VALID, artistIds: ["a1", "a2", "a1"] });
    expect(result.ok && result.data.artistIds).toEqual(["a1", "a2"]);
  });

  it("rejects an invalid condition", () => {
    expect(parseProductInput({ ...VALID, condition: "USED" }).ok).toBe(false);
  });

  it.each([
    ["negative", "-1"],
    ["non-numeric", "abc"],
    ["empty", ""],
    // Loose Number() coercions that must be rejected (mirrors quantity). "1e309"
    // → Infinity would otherwise store as Decimal "Infinity" and 500 in Prisma.
    ["infinity", "1e309"],
    ["hex", "0x10"],
    ["exponent", "1e3"],
    ["whitespace-only", "   "],
  ])("rejects %s price", (_label, price) => {
    expect(parseProductInput({ ...VALID, price }).ok).toBe(false);
  });

  it("rejects a non-finite numeric price", () => {
    expect(parseProductInput({ ...VALID, price: Infinity }).ok).toBe(false);
  });

  it("accepts a numeric price and stringifies it", () => {
    const result = parseProductInput({ ...VALID, price: 8.5 });
    expect(result.ok && result.data.price).toBe("8.5");
  });
});

describe("toProductData — derives inStock from quantity", () => {
  const base = {
    artistIds: ["a1", "a2"],
    title: "Torus",
    catalogNumber: null,
    labelId: "l1",
    genreId: "g1",
    productTypeId: "t1",
    condition: "NEW" as const,
    price: "10",
    description: null,
    coverImage: null,
  };

  it("in stock when quantity > 0", () => {
    const data = toProductData(
      { ...base, quantity: 3 },
      { primaryArtistName: "Vril", mode: "create" },
    );
    expect(data.quantity).toBe(3);
    expect(data.inStock).toBe(true);
  });

  it("passes coverImage through to the stored data", () => {
    const data = toProductData(
      { ...base, coverImage: "/uploads/cover.webp", quantity: 1 },
      { primaryArtistName: "Vril", mode: "create" },
    );
    expect(data.coverImage).toBe("/uploads/cover.webp");
  });

  it("out of stock when quantity is 0", () => {
    const data = toProductData(
      { ...base, quantity: 0 },
      { primaryArtistName: "Vril", mode: "create" },
    );
    expect(data.quantity).toBe(0);
    expect(data.inStock).toBe(false);
  });

  it("sets primaryArtistName and creates ordered ProductArtist links on create (no deleteMany)", () => {
    const data = toProductData(
      { ...base, quantity: 1 },
      { primaryArtistName: "Vril", mode: "create" },
    );
    expect(data.primaryArtistName).toBe("Vril");
    expect(data.productArtists).toEqual({
      create: [
        { artistId: "a1", position: 0 },
        { artistId: "a2", position: 1 },
      ],
    });
  });

  it("replaces the full artist set on update (deleteMany then create)", () => {
    const data = toProductData(
      { ...base, quantity: 1 },
      { primaryArtistName: "Vril", mode: "update" },
    );
    expect(data.productArtists).toEqual({
      deleteMany: {},
      create: [
        { artistId: "a1", position: 0 },
        { artistId: "a2", position: 1 },
      ],
    });
  });
});
