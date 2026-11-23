// CI-side net for the same spurious drift scripts/migrate-dev.ts strips at
// generation time: fails if any committed migration still contains a drop
// of the hand-written search_vector/trigram SQL (not modeled in
// schema.prisma, so `prisma migrate dev` recurrently re-proposes dropping
// it — see 90a50ef and tasks/lessons.md 2026-07-08 / 2026-07-17 /
// 2026-07-29b). Reuses clean-migration.ts's own detection so the two never
// drift apart on what counts as spurious.
//
//   Run: npx tsx scripts/check-migration-drift.ts
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { cleanMigrationSql } from "../lib/clean-migration";

const MIGRATIONS_DIR = join(__dirname, "..", "prisma", "migrations");

function main() {
  const dirs = readdirSync(MIGRATIONS_DIR).filter((entry) =>
    statSync(join(MIGRATIONS_DIR, entry)).isDirectory(),
  );

  const failures: { file: string; blocks: string[] }[] = [];

  for (const dir of dirs) {
    const file = join(MIGRATIONS_DIR, dir, "migration.sql");
    const { strippedBlocks } = cleanMigrationSql(readFileSync(file, "utf8"));
    if (strippedBlocks.length > 0) {
      failures.push({ file, blocks: strippedBlocks });
    }
  }

  if (failures.length > 0) {
    console.error(
      "Migration(s) drop the hand-written search_vector/trigram objects:\n",
    );
    for (const { file, blocks } of failures) {
      console.error(`${file}:`);
      for (const block of blocks) {
        console.error(`---\n${block}\n`);
      }
    }
    console.error(
      "Run `npx tsx scripts/clean-migration.ts <file>` (or regenerate via scripts/migrate-dev.ts) before committing.",
    );
    process.exit(1);
  }

  console.log(`${dirs.length} migration(s) checked, no search_vector/trigram drift found.`);
}

main();
