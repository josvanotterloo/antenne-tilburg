import { describe, it, expect } from "vitest";

import { generateLabelXml, missingLabelFields } from "@/lib/dymo-label";
import type { CatalogProduct } from "@/lib/catalog";

function product(over: Record<string, unknown> = {}): CatalogProduct {
  return {
    id: "p1",
    title: "Torus",
    catalogNumber: "ZR-001",
    price: "24.99",
    condition: "NEW",
    productArtists: [
      { position: 0, artistId: "a1", artist: { id: "a1", name: "Vril" } } as never,
    ],
    label: { id: "l1", name: "Zulema Records" } as never,
    genre: { id: "g1", name: "Techno" } as never,
    productType: { id: "t1", name: "LP" } as never,
    ...over,
  } as unknown as CatalogProduct;
}

describe("generateLabelXml", () => {
  it("returns a DieCutLabel document with the artist in uppercase", () => {
    const xml = generateLabelXml(product());
    expect(xml).toContain("<DieCutLabel");
    expect(xml).toContain("VRIL");
    expect(xml).not.toContain(">Vril<");
  });

  it("joins multiple artists with \" / \", uppercased", () => {
    const xml = generateLabelXml(
      product({
        productArtists: [
          { position: 0, artistId: "a1", artist: { id: "a1", name: "Jeff Mills" } },
          { position: 1, artistId: "a2", artist: { id: "a2", name: "Surgeon" } },
        ],
      }),
    );
    expect(xml).toContain("JEFF MILLS / SURGEON");
  });

  it('renders condition NEW as "Nieuw" and SECONDHAND as "Tweedehands"', () => {
    expect(generateLabelXml(product({ condition: "NEW" }))).toContain("Nieuw");
    expect(
      generateLabelXml(product({ condition: "SECONDHAND" })),
    ).toContain("Tweedehands");
  });

  it("omits the catalog number gracefully when absent, with no dangling separator", () => {
    const xml = generateLabelXml(product({ catalogNumber: null }));
    expect(xml).toContain("LP · Nieuw");
    expect(xml).not.toContain("· LP · Nieuw"); // no leading separator either
    expect(xml).not.toContain("null");
  });

  it("includes the catalog number, format and condition together when present", () => {
    const xml = generateLabelXml(product());
    expect(xml).toContain("ZR-001 · LP · Nieuw");
  });

  it("includes the product type (format) on line 3 even without a catalog number", () => {
    const xml = generateLabelXml(product({ catalogNumber: null }));
    expect(xml).toContain("LP");
  });

  it("formats price as € XX.XX", () => {
    const xml = generateLabelXml(product({ price: "9.5" }));
    expect(xml).toContain("€ 9.50");
  });

  it("includes the label name and genre as plain text", () => {
    const xml = generateLabelXml(product());
    expect(xml).toContain("Zulema Records");
    expect(xml).toContain("Techno");
  });

  it("includes the ANTENNE TILBURG brand text", () => {
    expect(generateLabelXml(product())).toContain("ANTENNE TILBURG");
  });

  it("XML-escapes special characters in text content", () => {
    const xml = generateLabelXml(
      product({ title: 'Rock & Roll <Live>', label: { id: "l1", name: "A&B" } }),
    );
    expect(xml).toContain("Rock &amp; Roll &lt;Live&gt;");
    expect(xml).toContain("A&amp;B");
    expect(xml).not.toContain("<Live>");
  });

  it("uses the 99012 label dimensions (5040 x 2040 twips)", () => {
    const xml = generateLabelXml(product());
    expect(xml).toContain('Units="twips"');
    expect(xml).toContain("99012");
    expect(xml).toContain('Width="5040"');
    expect(xml).toContain('Height="2040"');
  });
});

describe("missingLabelFields", () => {
  it("returns an empty array for a fully-populated product", () => {
    expect(missingLabelFields(product())).toEqual([]);
  });

  it("flags a missing artist", () => {
    expect(missingLabelFields(product({ productArtists: [] }))).toContain(
      "Artist",
    );
  });

  it("flags a blank title", () => {
    expect(missingLabelFields(product({ title: "   " }))).toContain("Title");
  });

  it("flags a null price", () => {
    expect(missingLabelFields(product({ price: null }))).toContain("Price");
  });

  it("flags a missing label/genre/productType", () => {
    expect(missingLabelFields(product({ label: null }))).toContain("Label");
    expect(missingLabelFields(product({ genre: null }))).toContain("Genre");
    expect(
      missingLabelFields(product({ productType: null })),
    ).toContain("Product Type");
  });

  it("lists every missing field at once, not just the first", () => {
    const missing = missingLabelFields(
      product({ productArtists: [], price: null }),
    );
    expect(missing).toEqual(["Artist", "Price"]);
  });
});
