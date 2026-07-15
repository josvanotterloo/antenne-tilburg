import { Prisma } from "@prisma/client";

import { db } from "@/lib/db";

// Shared catalog query logic for the public /stock listing and /admin/catalog.
// Keep all filtering/sorting/pagination server-side — the catalog may reach
// tens of thousands of rows.

export const JUST_IN_DAYS = 30;
export const PAGE_SIZE = 50;

export type CatalogSort = "date" | "artist" | "label";
export type SortOrder = "asc" | "desc";

export interface CatalogFilters {
  /** Exact artist name (case-insensitive) — powers the clickable artist link. */
  artist?: string | null;
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
  if (f.artist) where.artist = { equals: f.artist, mode: "insensitive" };
  if (f.genreId) where.genreId = f.genreId;
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

// Fresh /stock URLs filtering by a single artist or label — used by the clickable
// artist/label links on the listing and detail pages.
export const stockArtistHref = (artist: string) =>
  `/stock?artist=${encodeURIComponent(artist)}`;
export const stockLabelHref = (label: string) =>
  `/stock?label=${encodeURIComponent(label)}`;

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
      return [{ artist: explicit ?? "asc" }, { title: "asc" }];
    case "label":
      return { label: { name: explicit ?? "asc" } };
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

// Catalog search: the generated `search_vector` (full-word FTS) OR'd with pg_trgm
// trigram matching on artist/title — ILIKE for substrings/partials ("bio" and
// "sphere" both match "Biosphere") and the `%` similarity operator for fuzzy/typo
// matches. Returns matching product ids to inject into the Prisma where clause.
// Trigram GIN indexes (migration `catalog_fuzzy_search`) keep it fast.
export async function searchProductIds(q: string): Promise<string[]> {
  const term = q.trim();
  if (!term) return [];
  // Escape LIKE wildcards so a user-typed % or _ is matched literally.
  const like = `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  const rows = await db.$queryRaw<{ id: string }[]>(
    Prisma.sql`
      SELECT id FROM "Product"
      WHERE search_vector @@ websearch_to_tsquery('english', ${term})
         OR artist ILIKE ${like}
         OR title ILIKE ${like}
         OR artist % ${term}
         OR title % ${term}
    `,
  );
  return rows.map((r) => r.id);
}

const CATALOG_INCLUDE = {
  label: true,
  genre: true,
  productType: true,
} as const;

export type CatalogProduct = Prisma.ProductGetPayload<{
  include: typeof CATALOG_INCLUDE;
}>;

export interface CatalogQuery {
  q?: string;
  artist?: string | null;
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
    artist: query.artist,
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

// The N most recent in-stock arrivals, newest first. Powers the home "Just In"
// section (100 latest by createdAt, no pagination).
export function getLatestProducts(limit = 100): Promise<CatalogProduct[]> {
  return db.product.findMany({
    where: { inStock: true },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: CATALOG_INCLUDE,
  });
}

// ——— Weekly sections (This Week / Last Week / Back In Stock) ———

// The shop week runs Monday 00:00 – Sunday 24:00 in the shop's timezone, so
// week boundaries land where a Tilburg crate-digger expects them regardless
// of the server's clock.
export const SHOP_TZ = "Europe/Amsterdam";
export const BACK_IN_STOCK_DAYS = 30;

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

// Same filter semantics as getCatalogPage, narrowed to what the section
// pages' sidebar offers. `now` stays injectable for deterministic tests.
export interface SectionFilters {
  genreId?: string | null;
  condition?: "NEW" | "SECONDHAND" | null;
  now?: Date;
}

function sectionWhere(f: SectionFilters): Prisma.ProductWhereInput {
  return buildCatalogWhere({
    genreId: f.genreId,
    condition: f.condition,
    onlyInStock: true,
  });
}

function weekProducts(
  offsetWeeks: number,
  filters: SectionFilters,
): Promise<CatalogProduct[]> {
  const { start, end } = weekRange(offsetWeeks, filters.now ?? new Date());
  return db.product.findMany({
    where: { ...sectionWhere(filters), createdAt: { gte: start, lt: end } },
    orderBy: { createdAt: "desc" },
    include: CATALOG_INCLUDE,
  });
}

// In-stock products added in the current shop week.
export function getThisWeekProducts(
  filters: SectionFilters = {},
): Promise<CatalogProduct[]> {
  return weekProducts(0, filters);
}

// In-stock products added in the previous shop week.
export function getLastWeekProducts(
  filters: SectionFilters = {},
): Promise<CatalogProduct[]> {
  return weekProducts(-1, filters);
}

// In-stock products touched within the last BACK_IN_STOCK_DAYS whose
// updatedAt is meaningfully later than createdAt — i.e. changed since they
// arrived (a restock, a quantity edit, a sale that left stock remaining),
// not a brand-new arrival. Most recently updated first.
export async function getBackInStockProducts(
  filters: SectionFilters = {},
): Promise<CatalogProduct[]> {
  const now = filters.now ?? new Date();
  const rows = await db.product.findMany({
    where: {
      ...sectionWhere(filters),
      quantity: { gt: 0 },
      updatedAt: {
        gte: new Date(now.getTime() - BACK_IN_STOCK_DAYS * 86_400_000),
      },
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
    include: CATALOG_INCLUDE,
  });
  return rows.filter(
    (p) =>
      new Date(p.updatedAt).getTime() - new Date(p.createdAt).getTime() >
      RESTOCK_EPSILON_MS,
  );
}
