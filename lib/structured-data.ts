import { composeProductDescription, type CatalogProduct } from "@/lib/catalog";
import type { OpeningHoursSpec } from "@/lib/opening-hours";

const STORE_NAME = "Antenne Recordshop";
const STORE_URL = "https://antenne-tilburg.nl";

// Schema.org Product + MusicRecording markup for a public product detail page.
// `MusicRecording` is layered on since every listing here is a music release.
export function productJsonLd(product: CatalogProduct) {
  return {
    "@context": "https://schema.org",
    "@type": ["Product", "MusicRecording"],
    name: `${product.artist} — ${product.title}`,
    description: composeProductDescription(product),
    brand: { "@type": "Brand", name: product.label.name },
    ...(product.catalogNumber && { sku: product.catalogNumber }),
    category: product.genre.name,
    offers: {
      "@type": "Offer",
      price: Number(product.price).toFixed(2),
      priceCurrency: "EUR",
      availability: product.inStock
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      seller: { "@type": "MusicStore", name: STORE_NAME, url: STORE_URL },
    },
  };
}

// Schema.org MusicStore (LocalBusiness) markup for the home page.
export function localBusinessJsonLd(openingHoursSpecification: OpeningHoursSpec[]) {
  return {
    "@context": "https://schema.org",
    "@type": "MusicStore",
    name: STORE_NAME,
    url: STORE_URL,
    telephone: "+31135421708",
    address: {
      "@type": "PostalAddress",
      streetAddress: "Noordstraat 82",
      addressLocality: "Tilburg",
      postalCode: "5038 EK",
      addressCountry: "NL",
    },
    openingHoursSpecification,
  };
}
