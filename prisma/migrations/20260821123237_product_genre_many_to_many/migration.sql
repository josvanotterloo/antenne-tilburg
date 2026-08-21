-- Product <-> Genre: single required FK -> many-to-many via ProductGenre,
-- mirroring the existing ProductArtist pattern (a product can genuinely
-- belong to more than one genre — the legacy dump already proves this).
--
-- Hand-written (not `prisma migrate dev --create-only`): dropping a column
-- with non-null data makes that command refuse in this non-interactive
-- environment (tasks/lessons.md 2026-07-29c) — hand-write + `prisma migrate
-- deploy` instead, as that lesson recommends.
--
-- Also includes a new Genre name trigram index for lib/catalog.ts's
-- searchProductIds, alongside the existing artist/label ones.

-- CreateTable
CREATE TABLE "ProductGenre" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "genreId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProductGenre_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductGenre_productId_genreId_key" ON "ProductGenre"("productId", "genreId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductGenre_productId_position_key" ON "ProductGenre"("productId", "position");

-- CreateIndex
CREATE INDEX "ProductGenre_productId_idx" ON "ProductGenre"("productId");

-- CreateIndex
CREATE INDEX "ProductGenre_genreId_idx" ON "ProductGenre"("genreId");

-- AddForeignKey
ALTER TABLE "ProductGenre" ADD CONSTRAINT "ProductGenre_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductGenre" ADD CONSTRAINT "ProductGenre_genreId_fkey" FOREIGN KEY ("genreId") REFERENCES "Genre"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill: existing Product.genreId -> one ProductGenre row each,
-- position 0. gen_random_uuid() is built into Postgres 13+ (this DB runs
-- 16) — a straight 1:1 column-to-join-row copy needs no separate
-- TypeScript backfill script, unlike the original Artist entity migration
-- (which had to parse a free-text string).
INSERT INTO "ProductGenre" ("id", "productId", "genreId", "position")
SELECT gen_random_uuid()::text, "id", "genreId", 0 FROM "Product";

-- Drop the old single-genre FK + column now that every row has been
-- copied into ProductGenre.
ALTER TABLE "Product" DROP CONSTRAINT "Product_genreId_fkey";
DROP INDEX "Product_genreId_idx";
ALTER TABLE "Product" DROP COLUMN "genreId";

-- Trigram index for genre-name fuzzy/partial search (lib/catalog.ts's
-- searchProductIds). pg_trgm is already enabled.
CREATE INDEX genre_name_trgm_idx ON "Genre" USING GIN (name gin_trgm_ops);
