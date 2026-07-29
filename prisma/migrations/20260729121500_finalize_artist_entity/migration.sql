-- Finalize the Artist entity migration: require primaryArtistName, drop the
-- legacy `artist` column now that scripts/backfill-artists.ts has populated
-- Artist/ProductArtist for every existing product, and move full-text/
-- trigram search off the artist column onto Artist.name (see
-- docs/features/artist-entity-migration.md and lib/catalog.ts's
-- searchProductIds, which replaces the artist ILIKE/trigram clauses with an
-- EXISTS subquery against ProductArtist/Artist).
--
-- Hand-written, like the two migrations it supersedes
-- (20260703081015_catalog_search, 20260706090000_catalog_fuzzy_search):
-- `prisma migrate dev` cannot model a GENERATED STORED tsvector column or
-- trigram indexes, so this file is authored directly rather than generated.
-- Run only after scripts/backfill-artists.ts has confirmed zero products
-- without a linked artist.

-- Drop the old artist-inclusive generated column (this also drops the GIN
-- index that depended on it, product_search_idx).
ALTER TABLE "Product" DROP COLUMN "search_vector";

-- Redefine search_vector over title + description only — a GENERATED column
-- cannot reference a joined table, so artist matching moves to an EXISTS
-- subquery against ProductArtist/Artist instead.
ALTER TABLE "Product" ADD COLUMN "search_vector" tsvector
  GENERATED ALWAYS AS (
    to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, ''))
  ) STORED;

CREATE INDEX product_search_idx ON "Product" USING GIN(search_vector);

-- primaryArtistName has been backfilled for every product; enforce it.
ALTER TABLE "Product" ALTER COLUMN "primaryArtistName" SET NOT NULL;

-- Drop the legacy scalar column (this also drops product_artist_trgm_idx,
-- which depended on it).
ALTER TABLE "Product" DROP COLUMN "artist";

-- Trigram matching for artist names now targets Artist.name directly (a much
-- smaller table than Product). pg_trgm is already enabled (see
-- 20260706090000_catalog_fuzzy_search).
CREATE INDEX artist_name_trgm_idx ON "Artist" USING GIN (name gin_trgm_ops);
