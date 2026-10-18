// Shared app-level near-duplicate guard for the four reference entities
// (Label, Genre, Artist, Product Type). A DB-level unique index on the
// normalized name can't be added yet — existing data already has
// case-variant duplicates ("Jeff Mills" / "JEFF MILLS") that would fail the
// migration — so this is the only line of defense against a near-duplicate
// until that data is cleaned up (tracked in tasks/todo.md's Backlog).
//
// The normalized value is also persisted (normalizedName column, backfilled
// by scripts/backfill-normalized-names.ts) purely as a non-unique lookup
// index — never reimplement this normalization in SQL, or the backfilled
// column and future app-written rows can silently drift apart.

// Lowercase, unify "&"/"and", collapse whitespace, trim. Known edge case:
// this can make an unrelated "...and..." name collide with a "...&..." one
// (e.g. "R&B" / "R and B") — rare, and only ever causes an occasional false
// 409, so it's accepted rather than worked around.
export function normalizeReferenceName(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, " and ")
    .trim()
    .replace(/\s+/g, " ");
}

export interface NormalizedNameDelegate {
  findFirst(args: {
    where: { normalizedName: string; id?: { not: string } };
    select: { id: true };
  }): Promise<{ id: string } | null>;
}

// True if some OTHER row (or any row, when excludeId is omitted — the
// create case) already normalizes to the same name.
export async function findDuplicateByNormalizedName(
  delegate: NormalizedNameDelegate,
  name: string,
  excludeId?: string,
): Promise<boolean> {
  const normalizedName = normalizeReferenceName(name);
  const match = await delegate.findFirst({
    where: excludeId
      ? { normalizedName, id: { not: excludeId } }
      : { normalizedName },
    select: { id: true },
  });
  return match !== null;
}
