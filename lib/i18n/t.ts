import type { AdminLocale } from "@prisma/client";
import en from "./en.json";
import nl from "./nl.json";

export type TranslationKey = keyof typeof en;

export function t(key: TranslationKey, locale: AdminLocale): string {
  if (locale === "EN") return en[key];
  return (nl as Partial<Record<TranslationKey, string>>)[key] ?? en[key];
}
