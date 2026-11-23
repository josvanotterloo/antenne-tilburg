// Wraps `prisma migrate dev --create-only` so the generated migration.sql
// always goes through clean-migration.ts before it's reviewed, rather than
// relying on a developer remembering the manual second step — see
// docs/instructions/branching.md (Migrations) and tasks/lessons.md
// 2026-07-08 / 2026-07-17 / 2026-07-29b / 90a50ef (the one time the manual
// step was skipped, the hand-written search_vector/trigram SQL got
// silently dropped).
//
// Only generates and cleans — does NOT apply. Hand-verify the printed diff,
// same as before, then run `npm run prisma:migrate` to apply it.
//
//   Run: npx tsx scripts/migrate-dev.ts <migration-name>
import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { cleanMigrationSql } from "../lib/clean-migration";

const MIGRATIONS_DIR = join(__dirname, "..", "prisma", "migrations");

function latestMigrationDir(): string {
  const dirs = readdirSync(MIGRATIONS_DIR).filter((entry) =>
    statSync(join(MIGRATIONS_DIR, entry)).isDirectory(),
  );
  dirs.sort();
  const latest = dirs[dirs.length - 1];
  if (!latest) {
    throw new Error(`No migration directories found in ${MIGRATIONS_DIR}`);
  }
  return latest;
}

function main() {
  const name = process.argv[2];
  if (!name) {
    console.error("Usage: npx tsx scripts/migrate-dev.ts <migration-name>");
    process.exit(1);
  }

  const result = spawnSync(
    "npx",
    ["prisma", "migrate", "dev", "--create-only", "--skip-generate", "--name", name],
    { stdio: "inherit" },
  );
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }

  const migrationFile = join(MIGRATIONS_DIR, latestMigrationDir(), "migration.sql");
  const original = readFileSync(migrationFile, "utf8");
  const { cleaned, strippedBlocks } = cleanMigrationSql(original);

  if (strippedBlocks.length === 0) {
    console.log("clean-migration: no known-spurious lines found — nothing changed.");
  } else {
    writeFileSync(migrationFile, cleaned);
    console.log(
      `clean-migration: stripped ${strippedBlocks.length} known-spurious block(s) from ${migrationFile}:\n`,
    );
    for (const block of strippedBlocks) {
      console.log(`---\n${block}\n`);
    }
  }

  console.log(
    `Hand-verify ${migrationFile} before applying — this assists review, it does not replace it.\nApply with: npm run prisma:migrate`,
  );
}

main();
