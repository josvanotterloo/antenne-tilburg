// Strips the known-spurious drift lines that `prisma migrate dev
// --create-only` recurrently proposes for this repo's hand-written search
// infra (trigram GIN indexes + the search_vector GENERATED column) because
// that infra is raw SQL and can't be modeled in schema.prisma. See
// tasks/lessons.md 2026-07-08 / 2026-07-17 / 2026-07-29b.
//
// Pure over a string in, string out — no fs access — so the runnable CLI
// (scripts/clean-migration.ts) stays a thin wrapper. Assists the mandatory
// hand-verify step before `prisma migrate deploy`; does not replace it —
// patterns here are an allowlist of exactly the two recurring drift shapes,
// not a general-purpose migration sanitizer.
const SPURIOUS_LINE_PATTERNS = [
  // Drops a hand-written trigram (pg_trgm) GIN index.
  /^DROP INDEX "[A-Za-z0-9_]*_trgm_idx";$/,
  // Drops the hand-written full-text search index.
  /^DROP INDEX "product_search_idx";$/,
  // Drops the search_vector GENERATED column's default — fails P3018.
  /^ALTER TABLE "[A-Za-z]+" ALTER COLUMN "search_vector" DROP DEFAULT;$/,
];

function isSpuriousLine(line: string): boolean {
  const trimmed = line.trim();
  return SPURIOUS_LINE_PATTERNS.some((pattern) => pattern.test(trimmed));
}

export interface CleanMigrationResult {
  cleaned: string;
  strippedBlocks: string[];
}

// Prisma separates each generated statement (often preceded by its own
// one-line `-- AlterTable` / `-- DropIndex` comment) with a blank line.
// Treating each blank-line-separated block as the unit to keep/drop removes
// a spurious statement together with its header comment, not just the bare
// SQL line.
export function cleanMigrationSql(sql: string): CleanMigrationResult {
  const blocks = sql.split(/\n\s*\n/);
  const kept: string[] = [];
  const strippedBlocks: string[] = [];

  for (const block of blocks) {
    const lines = block.split("\n");
    if (lines.some(isSpuriousLine)) {
      strippedBlocks.push(block.trim());
    } else {
      kept.push(block);
    }
  }

  return { cleaned: kept.join("\n\n"), strippedBlocks };
}
