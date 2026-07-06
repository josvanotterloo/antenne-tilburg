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
