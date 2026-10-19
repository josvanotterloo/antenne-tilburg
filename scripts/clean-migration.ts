// Thin CLI wrapper around lib/clean-migration.ts's cleanMigrationSql. Strips
// the known-spurious drift lines `prisma migrate dev --create-only`
// recurrently proposes in this repo (see tasks/lessons.md 2026-07-08 /
// 2026-07-17 / 2026-07-29b) from a generated migration.sql file in place.
//
// This assists the existing hand-verify step before `prisma migrate deploy`
// — it does not replace it. Always re-read the printed diff yourself.
//
//   Run:  npx tsx scripts/clean-migration.ts prisma/migrations/<name>/migration.sql
import { readFileSync, writeFileSync } from "node:fs";

import { cleanMigrationSql } from "../lib/clean-migration";

function main() {
  const file = process.argv[2];
  if (!file) {
    console.error(
      "Usage: npx tsx scripts/clean-migration.ts <path-to-migration.sql>",
    );
    process.exit(1);
  }

  const original = readFileSync(file, "utf8");
  const { cleaned, strippedBlocks } = cleanMigrationSql(original);

  if (strippedBlocks.length === 0) {
    console.log("No known-spurious lines found — nothing changed.");
    return;
  }

  writeFileSync(file, cleaned);
  console.log(
    `Stripped ${strippedBlocks.length} known-spurious block(s) from ${file}:\n`,
  );
  for (const block of strippedBlocks) {
    console.log(`---\n${block}\n`);
  }
  console.log(
    "Hand-verify the remaining diff before `prisma migrate deploy` — this script assists, it does not replace review.",
  );
}

main();
