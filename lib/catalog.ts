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

// Full-text search against the generated `search_vector` (GIN-indexed).
// Returns matching product ids to inject into the Prisma where clause.
export async function searchProductIds(q: string): Promise<string[]> {
  const term = q.trim();
  if (!term) return [];
  const rows = await db.$queryRaw<{ id: string }[]>(
    Prisma.sql`SELECT id FROM "Product" WHERE search_vector @@ websearch_to_tsquery('english', ${term})`,
  );
  return rows.map((r) => r.id);
}
