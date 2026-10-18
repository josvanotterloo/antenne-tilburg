// One-time backfill core for the reference-entity dedupe guard
// (lib/reference-dedupe.ts): the normalizedName column lands with every
// existing row defaulted to "" (see prisma/migrations/
// 20261018182953_reference_normalized_name); this populates the real value
// using the exact same normalizeReferenceName the app writes going forward,
// so there is one implementation, never a second one in SQL. Pure over
// injected deps so it is unit-testable and reusable across the four
// entities; the runnable wrapper is scripts/backfill-normalized-names.ts.
// Idempotent: findRowsNeedingBackfill is expected to only return rows still
// at the "" placeholder, so a row already backfilled no longer matches and
// re-running after a partial run is safe.
import { normalizeReferenceName } from "@/lib/reference-dedupe";

export interface ReferenceRowNeedingBackfill {
  id: string;
  name: string;
}

export interface BackfillNormalizedNamesDeps {
  findRowsNeedingBackfill: () => Promise<ReferenceRowNeedingBackfill[]>;
  setNormalizedName: (args: {
    id: string;
    normalizedName: string;
  }) => Promise<unknown>;
}

export async function backfillNormalizedNames(
  deps: BackfillNormalizedNamesDeps,
): Promise<{ rowsBackfilled: number }> {
  const rows = await deps.findRowsNeedingBackfill();
  for (const row of rows) {
    await deps.setNormalizedName({
      id: row.id,
      normalizedName: normalizeReferenceName(row.name),
    });
  }
  return { rowsBackfilled: rows.length };
}
