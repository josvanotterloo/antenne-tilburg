-- Trigram index for label-name search (lib/catalog.ts's searchProductIds).
-- pg_trgm is already enabled (20260706090000_catalog_fuzzy_search).
--
-- Hand-written, like every other migration touching search_vector/trigram
-- indexes: `prisma migrate dev --create-only` always proposes dropping the
-- existing trigram indexes and the search_vector GENERATED column's default
-- (neither is modeled in schema.prisma), which would fail with P3018. Those
-- auto-generated lines are discarded here — this migration only adds the one
-- new index. See docs/features/fuzzy-search.md's migration gotcha section.
CREATE INDEX label_name_trgm_idx ON "Label" USING GIN (name gin_trgm_ops);
