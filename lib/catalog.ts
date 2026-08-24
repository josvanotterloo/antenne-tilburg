import { Prisma } from "@prisma/client";

import { db } from "@/lib/db";

// Shared catalog query logic for the public /stock listing and /admin/catalog.
// Keep all filtering/sorting/pagination server-side — the catalog may reach
// tens of thousands of rows.

export const JUST_IN_DAYS = 30;
export const PAGE_SIZE = 50;

export type CatalogSort = "date" | "artist" | "label" | "type" | "title";
export type SortOrder = "asc" | "desc";

// artistIds/labelId/productTypeId/justIn below, and the "artist"/"label" sort
// orders in buildCatalogOrderBy, are general-purpose filtering capability for
// admin/API consumers — no production caller currently exercises all of them
// (admin's catalog page only uses q/onlyInStock/sort:date/page as of the New
// Arrivals overhaul), but they remain part of this module's public contract;
// verify real callers before deleting rather than assuming dead code.
export interface CatalogFilters {
  /** Matches if ANY linked artist is in this set — powers the clickable
   * artist chips (multiple chips active = OR). */
  artistIds?: string[] | null;
  genreId?: string | null;
  labelId?: string | null;
  productTypeId?: string | null;
  condition?: "NEW" | "SECONDHAND" | null;
  justIn?: boolean;
  onlyInStock?: boolean;
  /** FTS-matched ids, injected when `q` is present. */
  ids?: string[] | null;
  /** Injectable for deterministic tests. */
  now?: Date;
}

export function buildCatalogWhere(f: CatalogFilters): Prisma.ProductWhereInput {
  const where: Prisma.ProductWhereInput = {};
  if (f.onlyInStock) where.inStock = true;
  if (f.condition) where.condition = f.condition;
  if (f.artistIds?.length) {
    where.productArtists = { some: { artistId: { in: f.artistIds } } };
  }
  if (f.genreId) where.productGenres = { some: { genreId: f.genreId } };
  if (f.labelId) where.labelId = f.labelId;
  if (f.productTypeId) where.productTypeId = f.productTypeId;
  if (f.justIn) {
    const now = f.now ?? new Date();
    where.createdAt = {
      gte: new Date(now.getTime() - JUST_IN_DAYS * 86_400_000),
    };
  }
  if (f.ids) where.id = { in: f.ids };
  return where;
}

// Ordered display name for a product's artist(s), joined "Artist1 / Artist2"
// — shared by every rendering surface (listing rows, detail page, RSS,
// structured data, newsletter).
export function joinArtistNames(
  productArtists: { position: number; artist: { name: string } }[],
): string {
  return [...productArtists]
    .sort((a, b) => a.position - b.position)
    .map((pa) => pa.artist.name)
    .join(" / ");
}

// Ordered display string for a product's genre(s), joined "Genre1 · Genre2"
// — shared by every rendering surface (admin list, public pages, RSS,
// structured data, print label falls back to just the first).
export function joinGenreNames(
  productGenres: { position: number; genre: { name: string } }[],
): string {
  return [...productGenres]
    .sort((a, b) => a.position - b.position)
    .map((pg) => pg.genre.name)
    .join(" · ");
}

// The product's own description, or a composed fallback — shared by the public
// detail page's <meta name="description"> and its Product JSON-LD.
export function composeProductDescription(p: {
  productArtists: { position: number; artist: { name: string } }[];
  title: string;
  description: string | null;
  productType: { name: string };
  label: { name: string };
}): string {
  return (
    p.description ??
    `${joinArtistNames(p.productArtists)} — ${p.title} (${p.productType.name}) on ${p.label.name}.`
  );
}

export function buildCatalogOrderBy(
  sort?: string,
  order?: string,
):
  | Prisma.ProductOrderByWithRelationInput
  | Prisma.ProductOrderByWithRelationInput[] {
  const explicit: SortOrder | undefined =
    order === "asc" ? "asc" : order === "desc" ? "desc" : undefined;
  switch (sort) {
    case "artist":
      return [{ primaryArtistName: explicit ?? "asc" }, { title: "asc" }];
    case "label":
      return { label: { name: explicit ?? "asc" } };
    case "type":
      return { productType: { name: explicit ?? "asc" } };
    case "title":
      return { title: explicit ?? "asc" };
    case "date":
    default:
      return { createdAt: explicit ?? "desc" };
  }
}

export function parsePage(page?: string | number): number {
  const n = typeof page === "number" ? page : Number.parseInt(page ?? "", 10);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

export function pageToSkip(page?: string | number): number {
  return (parsePage(page) - 1) * PAGE_SIZE;
}

export function pageCount(total: number): number {
  return Math.max(1, Math.ceil(total / PAGE_SIZE));
}

// Bounded set of page numbers to render: always first + last + the current
// page and its neighbours. Keeps pagination small even at hundreds of pages;
// the renderer inserts an ellipsis wherever the numbers are non-consecutive.
export function catalogPageNumbers(page: number, pageCount: number): number[] {
  const set = new Set<number>();
  for (const n of [1, page - 1, page, page + 1, pageCount]) {
    if (n >= 1 && n <= pageCount) set.add(n);
  }
  return [...set].sort((a, b) => a - b);
}

// A product is "Just In" if created within the last JUST_IN_DAYS. `now` is
// injectable for tests (and keeps time-reading out of component render bodies).
export function isJustIn(
  createdAt: Date | string,
  now: number = Date.now(),
): boolean {
  return now - new Date(createdAt).getTime() < JUST_IN_DAYS * 86_400_000;
}

// Catalog search: the generated `search_vector` (full-word FTS over title +
// description + contents) OR'd with pg_trgm trigram matching on title and
// contents — ILIKE for substrings/partials ("bio" and "sphere" both match
// "Biosphere") and the `%` similarity operator for fuzzy/typo matches — OR'd
// with EXISTS subqueries matching any linked artist's name, the product's
// label name, and any linked genre's name the same way (a GENERATED column
// can't reference a joined table, so none of artist/label/genre matching
// can live in search_vector itself). `contents` needs no EXISTS/join — it's
// a column on Product itself — so a name typed into a Various Artists
// product's contents (e.g. "Surgeon") matches the same way a real linked
// artist would. Returns matching product ids to inject into the Prisma
// where clause. Trigram GIN indexes (migrations `catalog_fuzzy_search`,
// `finalize_artist_entity`, `label_search_trgm`,
// `add_various_artists_support`, and `product_genre_many_to_many`) keep it
// fast.
export async function searchProductIds(q: string): Promise<string[]> {
  const term = q.trim();
  if (!term) return [];
  // Escape LIKE wildcards so a user-typed % or _ is matched literally.
  const like = `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  const rows = await db.$queryRaw<{ id: string }[]>(
    Prisma.sql`
      SELECT id FROM "Product" p
      WHERE p.search_vector @@ websearch_to_tsquery('english', ${term})
         OR p.title ILIKE ${like}
         OR p.title % ${term}
         OR p.contents ILIKE ${like}
         OR p.contents % ${term}
         OR EXISTS (
           SELECT 1 FROM "ProductArtist" pa
           JOIN "Artist" a ON a.id = pa."artistId"
           WHERE pa."productId" = p.id
             AND (a.name ILIKE ${like} OR a.name % ${term})
         )
         OR EXISTS (
           SELECT 1 FROM "Label" l
           WHERE l.id = p."labelId"
             AND (l.name ILIKE ${like} OR l.name % ${term})
         )
         OR EXISTS (
           SELECT 1 FROM "ProductGenre" pg
           JOIN "Genre" g ON g.id = pg."genreId"
           WHERE pg."productId" = p.id
             AND (g.name ILIKE ${like} OR g.name % ${term})
         )
    `,
  );
  return rows.map((r) => r.id);
}

export const CATALOG_INCLUDE = {
  label: true,
  productType: true,
  productArtists: {
    include: { artist: true },
    orderBy: { position: "asc" },
  },
  productGenres: {
    include: { genre: true },
    orderBy: { position: "asc" },
  },
} as const;

export type CatalogProduct = Prisma.ProductGetPayload<{
  include: typeof CATALOG_INCLUDE;
}>;

export interface CatalogQuery {
  q?: string;
  artistIds?: string[] | null;
  genreId?: string | null;
  labelId?: string | null;
  productTypeId?: string | null;
  condition?: "NEW" | "SECONDHAND" | null;
  justIn?: boolean;
  onlyInStock?: boolean;
  sort?: string;
  order?: string;
  page?: string | number;
}

export interface CatalogResult {
  products: CatalogProduct[];
  total: number;
  page: number;
  pageCount: number;
}

// Orchestrates a full catalog page: optional FTS, filtered/sorted query and the
// matching count run in parallel, server-side, always bounded by take/skip.
// Shared by /stock (onlyInStock) and /admin/catalog.
export async function getCatalogPage(
  query: CatalogQuery,
): Promise<CatalogResult> {
  const ids = query.q?.trim()
    ? await searchProductIds(query.q)
    : undefined;

  const where = buildCatalogWhere({
    artistIds: query.artistIds,
    genreId: query.genreId,
    labelId: query.labelId,
    productTypeId: query.productTypeId,
    condition: query.condition,
    justIn: query.justIn,
    onlyInStock: query.onlyInStock,
    ids,
  });
  const orderBy = buildCatalogOrderBy(query.sort, query.order);

  const [products, total] = await Promise.all([
    db.product.findMany({
      where,
      orderBy,
      skip: pageToSkip(query.page),
      take: PAGE_SIZE,
      include: CATALOG_INCLUDE,
    }),
    db.product.count({ where }),
  ]);

  return {
    products,
    total,
    page: parsePage(query.page),
    pageCount: pageCount(total),
  };
}

// The N most recent arrivals — in-stock only when onlyInStock is set,
// newest-first by default or sorted by sort/order when given (see
// buildCatalogOrderBy). Powers the home "Just In" section, the RSS feed,
// and public /stock (100 latest, no pagination).
export function getLatestProducts(
  limit = 100,
  onlyInStock = false,
  sort?: string,
  order?: string,
): Promise<CatalogProduct[]> {
  return db.product.findMany({
    where: buildCatalogWhere({ onlyInStock }),
    orderBy: buildCatalogOrderBy(sort, order),
    take: limit,
    include: CATALOG_INCLUDE,
  });
}

// The shop week runs Monday 00:00 – Sunday 24:00 in the shop's timezone, so
// week boundaries land where a Tilburg crate-digger expects them regardless
// of the server's clock.
export const SHOP_TZ = "Europe/Amsterdam";

// On create, createdAt (DB clock) and updatedAt (Prisma client clock) differ
// by milliseconds; a real restock is minutes-to-days later. One minute cleanly
// separates "never touched since creation" from "updated later".
const RESTOCK_EPSILON_MS = 60_000;

const SHOP_CLOCK = new Intl.DateTimeFormat("en-US", {
  timeZone: SHOP_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

// Wall-clock parts of an instant, read in the shop timezone.
function shopClock(at: Date) {
  const p = Object.fromEntries(
    SHOP_CLOCK.formatToParts(at).map((x) => [x.type, x.value]),
  );
  return {
    year: Number(p.year),
    month: Number(p.month),
    day: Number(p.day),
    hour: Number(p.hour) % 24, // "24" at midnight in some ICU versions
    minute: Number(p.minute),
    second: Number(p.second),
  };
}

// UTC instant of shop-local midnight on a calendar date: guess UTC midnight,
// then subtract the zone offset measured at the guess. Two passes absorb a
// DST change between guess and result (CET/CEST shift by one hour, at 02:00,
// so this always converges).
function shopMidnightUTC(year: number, month: number, day: number): Date {
  const target = Date.UTC(year, month - 1, day);
  let utc = target;
  for (let i = 0; i < 2; i++) {
    const c = shopClock(new Date(utc));
    const seen = Date.UTC(c.year, c.month - 1, c.day, c.hour, c.minute, c.second);
    utc -= seen - target;
  }
  return new Date(utc);
}

// [start, end) of the shop week containing `now`, shifted by whole weeks
// (0 = this week, -1 = last week). Monday 00:00 shop time is inclusive.
export function weekRange(
  offsetWeeks = 0,
  now: Date = new Date(),
): { start: Date; end: Date } {
  const c = shopClock(now);
  // Calendar-date arithmetic in UTC ms — no DST inside date-only math.
  const dateOnly = Date.UTC(c.year, c.month - 1, c.day);
  const mondayIdx = (new Date(dateOnly).getUTCDay() + 6) % 7; // Mon=0 … Sun=6
  const monday = new Date(
    dateOnly - mondayIdx * 86_400_000 + offsetWeeks * 7 * 86_400_000,
  );
  const nextMonday = new Date(monday.getTime() + 7 * 86_400_000);
  const toMidnight = (d: Date) =>
    shopMidnightUTC(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  return { start: toMidnight(monday), end: toMidnight(nextMonday) };
}

// Inclusive shop-local calendar-date range [from 00:00, day-after-to 00:00),
// as UTC instants. Returns null on malformed dates or a reversed range.
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function shopDayRange(
  from: string,
  to: string,
): { start: Date; end: Date } | null {
  const f = ISO_DATE.exec(from);
  const t = ISO_DATE.exec(to);
  if (!f || !t) return null;
  const start = shopMidnightUTC(Number(f[1]), Number(f[2]), Number(f[3]));
  const dayAfterTo = new Date(
    Date.UTC(Number(t[1]), Number(t[2]) - 1, Number(t[3])) + 86_400_000,
  );
  const end = shopMidnightUTC(
    dayAfterTo.getUTCFullYear(),
    dayAfterTo.getUTCMonth() + 1,
    dayAfterTo.getUTCDate(),
  );
  if (start.getTime() >= end.getTime()) return null;
  return { start, end };
}

// An instant's calendar date in the shop timezone, as yyyy-mm-dd (en-CA
// locale formats exactly that). Used for date-input defaults.
const SHOP_DATE = new Intl.DateTimeFormat("en-CA", {
  timeZone: SHOP_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function shopDateISO(date: Date): string {
  return SHOP_DATE.format(date);
}

// Human-readable date/time, pinned to SHOP_TZ — for use in server components,
// where the bare Date#toLocaleDateString()/toLocaleTimeString() would format
// using the server's own OS timezone/locale instead of the shop's.
const SHOP_DISPLAY_DATE = new Intl.DateTimeFormat("en-US", {
  timeZone: SHOP_TZ,
  year: "numeric",
  month: "numeric",
  day: "numeric",
});
const SHOP_DISPLAY_TIME = new Intl.DateTimeFormat("en-US", {
  timeZone: SHOP_TZ,
  hour: "numeric",
  minute: "2-digit",
});

export function shopDisplayDate(date: Date): string {
  return SHOP_DISPLAY_DATE.format(date);
}

export function shopDisplayTime(date: Date): string {
  return SHOP_DISPLAY_TIME.format(date);
}

// [start, end) of the given shop-local calendar month, as UTC instants.
// Returns null on malformed input (untrusted — comes from a URL query param).
const ISO_MONTH = /^(\d{4})-(\d{2})$/;

export function shopMonthRange(
  month: string,
): { start: Date; end: Date } | null {
  const m = ISO_MONTH.exec(month);
  if (!m) return null;
  const year = Number(m[1]);
  const mo = Number(m[2]);
  if (mo < 1 || mo > 12) return null;
  const start = shopMidnightUTC(year, mo, 1);
  const next = mo === 12 ? { y: year + 1, m: 1 } : { y: year, m: mo + 1 };
  const end = shopMidnightUTC(next.y, next.m, 1);
  return { start, end };
}

// An instant's shop-local calendar month, as YYYY-MM.
export function shopMonthISO(date: Date): string {
  return shopDateISO(date).slice(0, 7);
}

// month +/- delta whole months, wrapping across year boundaries. Assumes an
// already-valid "YYYY-MM" (page nav only — the untrusted-input path is
// shopMonthRange above).
export function shiftMonth(month: string, delta: number): string {
  const [year, mo] = month.split("-").map(Number);
  const total = year * 12 + (mo - 1) + delta;
  const newYear = Math.floor(total / 12);
  const newMonth = (total % 12) + 1;
  return `${newYear}-${String(newMonth).padStart(2, "0")}`;
}

// A restock: touched meaningfully after creation (see RESTOCK_EPSILON_MS)
// with stock remaining. Shared by Back In Stock and the newsletter arrivals.
export function isRestock(p: {
  createdAt: Date | string;
  updatedAt: Date | string;
  quantity: number;
}): boolean {
  return (
    p.quantity > 0 &&
    new Date(p.updatedAt).getTime() - new Date(p.createdAt).getTime() >
      RESTOCK_EPSILON_MS
  );
}
