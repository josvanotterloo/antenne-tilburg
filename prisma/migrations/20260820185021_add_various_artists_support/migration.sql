-- Various Artists / compilation support. Additive, no backfill (existing
-- rows default isVariousArtists=false, contents=null).
--
-- Hand-trimmed, like every other migration touching search_vector/trigram
-- indexes: `prisma migrate dev --create-only` proposed dropping the
-- artist/label/title trigram indexes and `product_search_idx`, plus an
-- `ALTER COLUMN "search_vector" DROP DEFAULT` — none of that is modeled in
-- schema.prisma (a generated STORED tsvector column and trigram indexes
-- can't be), so it's discarded here. See tasks/lessons.md 2026-07-08/17/29b
-- and prisma/migrations/20260729121500_finalize_artist_entity for the same
-- drop-and-recreate pattern.

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "contents" TEXT,
ADD COLUMN     "isVariousArtists" BOOLEAN NOT NULL DEFAULT false;

-- Redefine search_vector to also index contents — a GENERATED column can't
-- be ALTERed in place.
ALTER TABLE "Product" DROP COLUMN "search_vector";

ALTER TABLE "Product" ADD COLUMN "search_vector" tsvector
  GENERATED ALWAYS AS (
    to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, '') || ' ' || coalesce(contents, ''))
  ) STORED;

CREATE INDEX product_search_idx ON "Product" USING GIN(search_vector);

-- Trigram index for contents fuzzy/partial matching (lib/catalog.ts's
-- searchProductIds). pg_trgm is already enabled.
CREATE INDEX product_contents_trgm_idx ON "Product" USING GIN (contents gin_trgm_ops);
