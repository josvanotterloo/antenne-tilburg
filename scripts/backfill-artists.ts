// One-time migration: turn each Product's legacy plain-text `artist` column
// into a proper Artist row + ProductArtist link, deduplicating by name
// case-insensitively.
//
//   Run AFTER the `add_artist_entity` migration and BEFORE
//   `finalize_artist_entity` (which drops Product.artist and requires
//   primaryArtistName to be NOT NULL) — see docs/features/artist-entity-migration.md.
//
//   Run:  npx tsx scripts/backfill-artists.ts
//
// Idempotent: products that already have a ProductArtist link are skipped,
// so re-running after a partial failure is safe.
import { PrismaClient } from "@prisma/client";

import { backfillArtists } from "../lib/backfill-artists";

const prisma = new PrismaClient();

async function main() {
  const result = await backfillArtists({
    // Raw SQL, not the typed Prisma Client model: `artist` is dropped from
    // schema.prisma by the finalize_artist_entity migration, so this read
    // stays valid (and this script stays runnable against any database that
    // still physically has the column, i.e. one migrated no further than
    // add_artist_entity) regardless of what the current schema declares.
    findProductsNeedingBackfill: () =>
      prisma.$queryRaw<{ id: string; artist: string }[]>`
        SELECT p.id, p.artist FROM "Product" p
        WHERE NOT EXISTS (
          SELECT 1 FROM "ProductArtist" pa WHERE pa."productId" = p.id
        )
      `,
    findOrCreateArtist: async (name) => {
      const existing = await prisma.artist.findFirst({
        where: { name: { equals: name, mode: "insensitive" } },
      });
      if (existing) return { ...existing, created: false };
      const created = await prisma.artist.create({ data: { name } });
      return { ...created, created: true };
    },
    linkProductArtist: ({ productId, artistId, position }) =>
      prisma.productArtist
        .create({ data: { productId, artistId, position } })
        .then(() => undefined),
    setPrimaryArtistName: ({ productId, primaryArtistName }) =>
      prisma.product
        .update({ where: { id: productId }, data: { primaryArtistName } })
        .then(() => undefined),
    countProductsWithoutArtist: () =>
      prisma.product.count({ where: { productArtists: { none: {} } } }),
  });

  console.log(
    `Done: ${result.productsLinked} product(s) linked, ${result.artistsCreated} new Artist row(s) created.`,
  );
  if (result.remainingWithoutArtist > 0) {
    console.warn(
      `${result.remainingWithoutArtist} product(s) still have no linked artist — investigate before running the finalize_artist_entity migration.`,
    );
    process.exitCode = 1;
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
