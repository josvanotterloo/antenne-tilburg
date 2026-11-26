import type { AdminLocale } from "@prisma/client";
import en from "./en.json";
import nl from "./nl.json";

export type TranslationKey = keyof typeof en;

export function t(key: TranslationKey, locale: AdminLocale): string {
  if (locale === "EN") return en[key];
  return (nl as Partial<Record<TranslationKey, string>>)[key] ?? en[key];
}

// One/other plural selection for a count string — "1 product" vs "4
// products"/"4 producten". Dictionaries never hold the number itself (that
// stays dynamic); each entity gets its own singular and plural key.
//
//   tCount(1, "products.countSingular", "products.countPlural", "EN") → "product"
//   tCount(2, "products.countSingular", "products.countPlural", "EN") → "products"
//   tCount(0, "products.countSingular", "products.countPlural", "NL") → "producten"
//     (0 is plural, not singular, same as English "0 products")
// No failure mode: count is never validated, so there's nothing to show beyond this.
// Asserted in lib/i18n/t.test.ts's "tCount" describe block.
export function tCount(
  count: number,
  singularKey: TranslationKey,
  pluralKey: TranslationKey,
  locale: AdminLocale,
): string {
  return t(count === 1 ? singularKey : pluralKey, locale);
}
