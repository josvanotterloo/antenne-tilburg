import { describe, it, expect } from "vitest";

import { productJsonLd, localBusinessJsonLd } from "@/lib/structured-data";

const PRODUCT = {
  id: "p1",
  artist: "Vril",
  title: "Torus",
  catalogNumber: "ZR-001",
  price: "24.99",
  condition: "NEW",
  inStock: true,
  description: "Hypnotic dub-techno LP.",
  label: { id: "l1", name: "Zulema Records" },
  genre: { id: "g1", name: "Techno" },
  productType: { id: "t1", name: "LP" },
};

describe("productJsonLd", () => {
  it("builds a Product + MusicRecording block with the correct price and InStock availability", () => {
    const ld = productJsonLd(PRODUCT as never);
    expect(ld["@type"]).toEqual(["Product", "MusicRecording"]);
    expect(ld.name).toBe("Vril — Torus");
    expect(ld.description).toBe("Hypnotic dub-techno LP.");
    expect(ld.brand).toEqual({ "@type": "Brand", name: "Zulema Records" });
    expect(ld.sku).toBe("ZR-001");
    expect(ld.category).toBe("Techno");
    expect(ld.offers).toMatchObject({
      "@type": "Offer",
      price: "24.99",
      priceCurrency: "EUR",
      availability: "https://schema.org/InStock",
      seller: {
        "@type": "MusicStore",
        name: "Antenne Recordshop",
        url: "https://antenne-tilburg.nl",
      },
    });
  });

  it("renders OutOfStock availability when the product is not in stock", () => {
    const ld = productJsonLd({ ...PRODUCT, inStock: false } as never);
    expect(ld.offers.availability).toBe("https://schema.org/OutOfStock");
  });

  it("omits sku when there is no catalog number", () => {
    const ld = productJsonLd({ ...PRODUCT, catalogNumber: null } as never);
    expect(ld.sku).toBeUndefined();
  });

  it("falls back to a composed description when the product has none", () => {
    const ld = productJsonLd({ ...PRODUCT, description: null } as never);
    expect(ld.description).toBe("Vril — Torus (LP) on Zulema Records.");
  });
});

describe("localBusinessJsonLd", () => {
  it("builds a MusicStore block with the given opening hours", () => {
    const hours = [
      {
        "@type": "OpeningHoursSpecification" as const,
        dayOfWeek: "Monday",
        opens: "12:00",
        closes: "18:00",
      },
    ];
    const ld = localBusinessJsonLd(hours);
    expect(ld["@type"]).toBe("MusicStore");
    expect(ld.name).toBe("Antenne Recordshop");
    expect(ld.url).toBe("https://antenne-tilburg.nl");
    expect(ld.telephone).toBe("+31135421708");
    expect(ld.address).toEqual({
      "@type": "PostalAddress",
      streetAddress: "Noordstraat 82",
      addressLocality: "Tilburg",
      postalCode: "5038 EK",
      addressCountry: "NL",
    });
    expect(ld.openingHoursSpecification).toBe(hours);
  });
});
