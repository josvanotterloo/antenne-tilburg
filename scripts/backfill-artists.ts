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
    // One db.$transaction, not two separate writes: either the ProductArtist
    // link and primaryArtistName both land, or neither does. Prevents a
    // crash mid-loop from leaving a product half-migrated in a way the
    // completion check below can't see.
    linkAndSetPrimaryArtist: ({ productId, artistId, artistName, position }) =>
      prisma
        .$transaction([
          prisma.productArtist.create({ data: { productId, artistId, position } }),
          prisma.product.update({
            where: { id: productId },
            data: { primaryArtistName: artistName },
          }),
        ])
        .then(() => undefined),
    // Secondary artist on a split legacy string (e.g. the "Surgeon" half of
    // "Jeff Mills / Surgeon") — just a link; primaryArtistName is already
    // set by linkAndSetPrimaryArtist for position 0.
    linkArtist: ({ productId, artistId, position }) =>
      prisma.productArtist
        .create({ data: { productId, artistId, position } })
        .then(() => undefined),
    // Raw SQL, not the typed Prisma Client model: primaryArtistName is
    // declared as required (non-null) String in the *finalized* schema.prisma,
    // so the generated client's where-filter type doesn't accept `null` for
    // it — but at backfill time (pre-finalize_artist_entity) the column is
    // still nullable in the actual database. Also checks primaryArtistName
    // directly rather than only link existence, so a product left over from
    // any prior non-transactional partial run (link present, name still
    // null) is correctly reported as not done, not silently skipped.
    countProductsWithoutArtist: async () => {
      const [{ count }] = await prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*)::bigint AS count FROM "Product" p
        WHERE NOT EXISTS (
          SELECT 1 FROM "ProductArtist" pa WHERE pa."productId" = p.id
        ) OR p."primaryArtistName" IS NULL
      `;
      return Number(count);
    },
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
