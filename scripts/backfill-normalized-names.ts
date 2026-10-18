// One-time migration for the reference-entity dedupe guard: every existing
// Artist/Genre/Label/ProductType row got normalizedName: "" when the column
// was added (see prisma/migrations/20261018182953_reference_normalized_name).
// This populates the real value, using the app's own normalizeReferenceName
// — not a SQL reimplementation — so the backfilled value and anything the
// app writes going forward can never drift apart.
//
//   Run AFTER the reference_normalized_name migration —
//   see docs/qa/claude-code-prompts-revised-5-6.md's STEP 5b.
//
//   Run:  npx tsx --env-file=.env scripts/backfill-normalized-names.ts
//
// Idempotent: only rows still at the "" placeholder are selected, so
// already-backfilled rows no longer match and re-running after a partial
// failure is safe.
import { PrismaClient } from "@prisma/client";

import { backfillNormalizedNames } from "../lib/backfill-normalized-names";

const prisma = new PrismaClient();

// Same narrow-interface-plus-cast pattern as lib/reference-crud.ts's
// ReferenceDelegate — the four Prisma delegates don't share a real common
// type, but all expose this shape.
interface NormalizedNameBackfillDelegate {
  findMany(args: {
    where: { normalizedName: string };
    select: { id: true; name: true };
  }): Promise<{ id: string; name: string }[]>;
  update(args: {
    where: { id: string };
    data: { normalizedName: string };
  }): Promise<unknown>;
}

const MODELS: { label: string; delegate: NormalizedNameBackfillDelegate }[] = [
  { label: "Artist", delegate: prisma.artist as unknown as NormalizedNameBackfillDelegate },
  { label: "Genre", delegate: prisma.genre as unknown as NormalizedNameBackfillDelegate },
  { label: "Label", delegate: prisma.label as unknown as NormalizedNameBackfillDelegate },
  {
    label: "Product Type",
    delegate: prisma.productType as unknown as NormalizedNameBackfillDelegate,
  },
];

async function main() {
  for (const { label, delegate } of MODELS) {
    const result = await backfillNormalizedNames({
      findRowsNeedingBackfill: () =>
        delegate.findMany({
          where: { normalizedName: "" },
          select: { id: true, name: true },
        }),
      setNormalizedName: ({ id, normalizedName }) =>
        delegate.update({ where: { id }, data: { normalizedName } }),
    });
    console.log(`${label}: ${result.rowsBackfilled} row(s) backfilled.`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
