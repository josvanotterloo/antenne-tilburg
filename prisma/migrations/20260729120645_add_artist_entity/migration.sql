-- NOTE: hand-edited. `prisma migrate dev --create-only` auto-generated DROP
-- INDEX statements for product_artist_trgm_idx / product_search_idx /
-- product_title_trgm_idx and an `ALTER COLUMN "search_vector" DROP DEFAULT`
-- here, because search_vector + its trigram indexes are hand-written raw SQL
-- Prisma can't model (see docs/features/fuzzy-search.md, tasks/lessons.md
-- 2026-07-08/2026-07-17). This migration is purely additive — the redefinition
-- of search_vector/trigram indexes happens deliberately in the
-- finalize_artist_entity migration, not here. Removed all of that drift.

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "primaryArtistName" TEXT,
ALTER COLUMN "artist" DROP NOT NULL;

-- CreateTable
CREATE TABLE "Artist" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Artist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductArtist" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "artistId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProductArtist_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Artist_name_key" ON "Artist"("name");

-- CreateIndex
CREATE INDEX "ProductArtist_productId_idx" ON "ProductArtist"("productId");

-- CreateIndex
CREATE INDEX "ProductArtist_artistId_idx" ON "ProductArtist"("artistId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductArtist_productId_artistId_key" ON "ProductArtist"("productId", "artistId");

-- CreateIndex
CREATE INDEX "Product_primaryArtistName_idx" ON "Product"("primaryArtistName");

-- AddForeignKey
ALTER TABLE "ProductArtist" ADD CONSTRAINT "ProductArtist_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductArtist" ADD CONSTRAINT "ProductArtist_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "Artist"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
