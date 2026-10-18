import { Prisma } from "@prisma/client";

import { db } from "@/lib/db";

// "Did you mean" fuzzy suggestions for a newly-created Artist (STEP 5c) —
// warns, never blocks (5b's exact-normalized-name check already runs first
// and handles the real-duplicate case). Uses the same pg_trgm `%` similarity
// operator as lib/catalog.ts's searchProductIds, against
// artist_name_trgm_idx (already created by the artist-entity migration,
// prisma/migrations/20260729121500_finalize_artist_entity — not new here).

const MAX_CANDIDATES = 5;

export interface SimilarArtist {
  id: string;
  name: string;
  productCount: number;
}

export async function findSimilarArtists(
  name: string,
  excludeId: string,
): Promise<SimilarArtist[]> {
  const term = name.trim();
  if (!term) return [];
  const rows = await db.$queryRaw<SimilarArtist[]>(
    Prisma.sql`
      SELECT a.id, a.name, count(pa.id)::int AS "productCount"
      FROM "Artist" a
      LEFT JOIN "ProductArtist" pa ON pa."artistId" = a.id
      WHERE a.name % ${term} AND a.id <> ${excludeId}
      GROUP BY a.id, a.name
      ORDER BY similarity(a.name, ${term}) DESC
      LIMIT ${MAX_CANDIDATES}
    `,
  );
  return rows;
}
