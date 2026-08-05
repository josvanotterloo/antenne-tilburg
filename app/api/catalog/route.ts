import { NextResponse } from "next/server";
import { Condition } from "@prisma/client";

import { db } from "@/lib/db";
import { buildCatalogWhere, isRestock, CATALOG_INCLUDE } from "@/lib/catalog";

const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

function parseLimit(raw: string | null): number {
  const n = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(n) || n < 1) return DEFAULT_LIMIT;
  return Math.min(n, MAX_LIMIT);
}

function parseCondition(raw: string | null): Condition | undefined {
  return raw === "NEW" || raw === "SECONDHAND" ? raw : undefined;
}

// Public, unauthenticated catalog feed for AI shopping agents / discoverability.
// Read-only: only in-stock products, no PII, cache-friendly.
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const genre = params.get("genre");
  const condition = parseCondition(params.get("condition"));
  const limit = parseLimit(params.get("limit"));

  const where = {
    ...buildCatalogWhere({ onlyInStock: true, condition }),
    ...(genre && { genre: { is: { name: { equals: genre, mode: "insensitive" as const } } } }),
  };

  try {
    const [products, total] = await Promise.all([
      db.product.findMany({
        where,
        // id tiebreaker keeps ordering stable across requests when several
        // products share a createdAt (bulk import, same-millisecond inserts).
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        take: limit,
        include: CATALOG_INCLUDE,
      }),
      db.product.count({ where }),
    ]);

    return NextResponse.json(
      {
        products: products.map((p) => ({
          id: p.id,
          // Deliberate interface change: ordered artists, not a single string
          // — a release can have multiple (splits, comps, collaborations).
          artists: [...p.productArtists]
            .sort((a, b) => a.position - b.position)
            .map((pa) => ({ id: pa.artist.id, name: pa.artist.name })),
          title: p.title,
          label: p.label.name,
          catalogNumber: p.catalogNumber,
          genre: p.genre.name,
          productType: p.productType.name,
          condition: p.condition,
          inStock: p.inStock,
          isRestock: isRestock(p),
          url: `${baseUrl}/stock/${p.id}`,
          createdAt: p.createdAt.toISOString(),
        })),
        total,
        generatedAt: new Date().toISOString(),
      },
      { headers: { "Cache-Control": "public, max-age=300" } },
    );
  } catch (error) {
    console.error("GET /api/catalog failed", error);
    return NextResponse.json(
      { error: "Could not load the catalog. Please try again." },
      { status: 500 },
    );
  }
}
