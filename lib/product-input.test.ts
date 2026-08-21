// @vitest-environment node
import { describe, it, expect } from "vitest";

import { parseProductInput, toProductData } from "@/lib/product-input";

const VALID = {
  artistIds: ["a1"],
  title: "Torus",
  catalogNumber: "ZR-001",
  labelId: "l1",
  genreIds: ["g1"],
  productTypeId: "t1",
  condition: "NEW",
  price: "24.99",
  description: "  hypnotic  ",
  supplierId: null,
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
      genreIds: ["g1"],
      productTypeId: "t1",
      condition: "NEW",
      price: "24.99",
      description: "hypnotic", // trimmed
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

  it("nullifies blank optionals", () => {
    const result = parseProductInput({
      ...VALID,
      catalogNumber: "",
      description: "  ",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.catalogNumber).toBeNull();
    expect(result.data.description).toBeNull();
  });

  it.each([
    ["title", { ...VALID, title: "" }],
    ["labelId", { ...VALID, labelId: "" }],
    ["genreIds", { ...VALID, genreIds: [] }],
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

  it.each([
    ["empty array", []],
    ["not an array", "g1"],
    ["blank entry", ["g1", "   "]],
    ["non-string entry", ["g1", 2]],
  ])("rejects genreIds: %s", (_label, genreIds) => {
    expect(parseProductInput({ ...VALID, genreIds }).ok).toBe(false);
  });

  it("accepts multiple genreIds, preserving order", () => {
    const result = parseProductInput({ ...VALID, genreIds: ["g1", "g2"] });
    expect(result.ok && result.data.genreIds).toEqual(["g1", "g2"]);
  });

  it("dedupes repeated genreIds, preserving first-seen order", () => {
    const result = parseProductInput({ ...VALID, genreIds: ["g1", "g2", "g1"] });
    expect(result.ok && result.data.genreIds).toEqual(["g1", "g2"]);
  });

  it("rejects an invalid condition", () => {
    expect(parseProductInput({ ...VALID, condition: "USED" }).ok).toBe(false);
  });

  it.each([
    ["negative", "-1"],
    ["non-numeric", "abc"],
    ["empty", ""],
    // Loose Number() coercions that must be rejected. "1e309" → Infinity
    // would otherwise store as Decimal "Infinity" and 500 in Prisma.
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

  it("accepts an optional supplierId and nullifies it when absent", () => {
    const withSupplier = parseProductInput({ ...VALID, supplierId: "s1" });
    expect(withSupplier.ok).toBe(true);
    if (withSupplier.ok) expect(withSupplier.data.supplierId).toBe("s1");

    const without = parseProductInput(VALID);
    expect(without.ok).toBe(true);
    if (without.ok) expect(without.data.supplierId).toBeNull();
  });

  it("defaults isVariousArtists to false and contents to null when absent", () => {
    const result = parseProductInput(VALID);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.isVariousArtists).toBe(false);
    expect(result.data.contents).toBeNull();
  });

  it("skips the artist-required check when isVariousArtists is true", () => {
    const result = parseProductInput({
      ...VALID,
      artistIds: [],
      isVariousArtists: true,
      contents: "Surgeon, Regis",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.artistIds).toEqual([]);
    expect(result.data.contents).toBe("Surgeon, Regis");
  });

  it("still requires artistIds when isVariousArtists is false", () => {
    const result = parseProductInput({
      ...VALID,
      artistIds: [],
      isVariousArtists: false,
    });
    expect(result.ok).toBe(false);
  });

  it("forces contents to null when isVariousArtists is false, even if sent", () => {
    const result = parseProductInput({
      ...VALID,
      isVariousArtists: false,
      contents: "Surgeon, Regis",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.contents).toBeNull();
  });

  it("nullifies blank contents when isVariousArtists is true", () => {
    const result = parseProductInput({
      ...VALID,
      isVariousArtists: true,
      contents: "   ",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.contents).toBeNull();
  });
});

describe("toProductData — no longer touches quantity/inStock", () => {
  const base = {
    artistIds: ["a1", "a2"],
    title: "Torus",
    catalogNumber: null,
    labelId: "l1",
    genreIds: ["g1", "g2"],
    productTypeId: "t1",
    supplierId: null,
    condition: "NEW" as const,
    price: "10",
    description: null,
    coverImage: null,
    isVariousArtists: false,
    contents: null,
  };

  it("passes isVariousArtists and contents through to the stored data", () => {
    const data = toProductData(
      { ...base, isVariousArtists: true, contents: "Surgeon, Regis" },
      { primaryArtistName: "Various Artists", mode: "create" },
    );
    expect(data.isVariousArtists).toBe(true);
    expect(data.contents).toBe("Surgeon, Regis");
  });

  it("never includes quantity or inStock in the returned data", () => {
    const data = toProductData(base, { primaryArtistName: "Vril", mode: "create" });
    expect(data).not.toHaveProperty("quantity");
    expect(data).not.toHaveProperty("inStock");
  });

  it("passes coverImage through to the stored data", () => {
    const data = toProductData(
      { ...base, coverImage: "/uploads/cover.webp" },
      { primaryArtistName: "Vril", mode: "create" },
    );
    expect(data.coverImage).toBe("/uploads/cover.webp");
  });

  it("sets primaryArtistName and creates ordered ProductArtist links on create (no deleteMany)", () => {
    const data = toProductData(
      base,
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
      base,
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

  it("creates ordered ProductGenre links on create (no deleteMany)", () => {
    const data = toProductData(base, { primaryArtistName: "Vril", mode: "create" });
    expect(data.productGenres).toEqual({
      create: [
        { genreId: "g1", position: 0 },
        { genreId: "g2", position: 1 },
      ],
    });
  });

  it("replaces the full genre set on update (deleteMany then create)", () => {
    const data = toProductData(base, { primaryArtistName: "Vril", mode: "update" });
    expect(data.productGenres).toEqual({
      deleteMany: {},
      create: [
        { genreId: "g1", position: 0 },
        { genreId: "g2", position: 1 },
      ],
    });
  });

  it("connects supplier when supplierId is set", () => {
    const parsed = parseProductInput({ ...VALID, supplierId: "s1" });
    if (!parsed.ok) throw new Error("expected ok");
    const data = toProductData(parsed.data, { primaryArtistName: "Vril", mode: "create" });
    expect(data).toHaveProperty("supplier", { connect: { id: "s1" } });
  });

  it("omits supplier on create when supplierId is null", () => {
    const parsed = parseProductInput(VALID);
    if (!parsed.ok) throw new Error("expected ok");
    const data = toProductData(parsed.data, { primaryArtistName: "Vril", mode: "create" });
    expect(data).not.toHaveProperty("supplier");
  });

  it("disconnects supplier on update when supplierId is null", () => {
    const parsed = parseProductInput(VALID);
    if (!parsed.ok) throw new Error("expected ok");
    const data = toProductData(parsed.data, { primaryArtistName: "Vril", mode: "update" });
    expect(data).toHaveProperty("supplier", { disconnect: true });
  });
});
