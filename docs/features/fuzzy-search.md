# Fuzzy catalog search (pg_trgm)

**Status:** branch `feature/fuzzy-search` — merged to `master` (2026-07-06).

## Summary
Catalog search now matches partial and mistyped queries, not just exact full words.

## What changed
- **Migration `catalog_fuzzy_search`:** `CREATE EXTENSION IF NOT EXISTS pg_trgm` plus GIN
  trigram indexes (`gin_trgm_ops`) on `Product.artist` and `Product.title`.
- **`searchProductIds` (`lib/catalog.ts`):** the query now OR's three matchers:
  1. `search_vector @@ websearch_to_tsquery(...)` — full-word FTS (unchanged).
  2. `artist/title ILIKE '%term%'` — substring/partial matches (trigram-accelerated).
  3. `artist/title % term` — the pg_trgm similarity operator, for fuzzy/typo matches.
  User-typed `%` / `_` are escaped so they match literally.

## Why this shape
- The requested examples ("bio", "sphere" → "Biosphere") are substrings, so `ILIKE`
  guarantees them deterministically; the `%` operator adds genuine typo tolerance. Both
  use the trigram indexes. `similarity()` alone (threshold 0.3) would miss "bio"
  (~0.27 similarity to "Biosphere"), which is why ILIKE carries the substring case.

## Tests & verification
- Unit tests (257 total green): query construction combines FTS + ILIKE + `%`; the term
  and the `%term%` pattern are bound as params; LIKE wildcards are escaped.
- **Live against Postgres:** `bio` / `sphere` / `biosfere` (typo) / `substrata` all →
  "Biosphere — Substrata"; `vril` → "Vril — Torus"; `surgeon` → none (no false hits).

## Notes
- Actual matching is verified live (as with the original FTS) because the unit layer
  mocks `$queryRaw`; the tests lock the query *shape* so fuzzy matching can't silently
  regress.

## ⚠️ Migration gotcha (read before running `prisma migrate dev`)
The `search_vector` column is a Postgres **`GENERATED ALWAYS ... STORED` tsvector** and
the `product_*_trgm_idx` GIN indexes are created in **raw SQL** — neither can be
represented in `schema.prisma` (it declares `searchVector Unsupported("tsvector")?`, with
no generation expression or index). Prisma therefore sees permanent "drift" and **every
`prisma migrate dev` regenerates a migration that drops the trigram indexes and runs
`ALTER TABLE "Product" ALTER COLUMN "search_vector" DROP DEFAULT`** — which fails with
**P3018** (you can't drop a default on a generated column), and would break this feature
if it did apply.

**Always create migrations with `--create-only`, then delete the auto-added `Product`
`search_vector` / trigram-index lines before applying** (hand-write the migration — see
`prisma/migrations/20260707140000_newsletter_optin` for the pattern). If a broken drift
migration has already failed: `prisma migrate resolve --rolled-back "<name>"`, delete its
directory, and confirm `prisma migrate status` is clean. (First hit: 2026-07-08, logged
in `tasks/lessons.md`.)
