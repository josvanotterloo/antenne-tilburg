-- Fuzzy catalog search: trigram (pg_trgm) partial + similarity matching alongside
-- the existing tsvector full-text search. Powers `searchProductIds` in lib/catalog.ts.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- GIN trigram indexes accelerate ILIKE '%term%' (partial/substring matches) and the
-- `%` similarity operator (fuzzy/typo matches) on artist and title.
CREATE INDEX IF NOT EXISTS product_artist_trgm_idx ON "Product" USING GIN (artist gin_trgm_ops);
CREATE INDEX IF NOT EXISTS product_title_trgm_idx ON "Product" USING GIN (title gin_trgm_ops);
