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

## Update (2026-08-18): label name added to `searchProductIds`

Admin/public catalog search didn't match label name (e.g. searching "Warp
Records" or "Tresor" returned nothing, even with matching products) —
`searchProductIds` only ever covered title/description (`search_vector`)
and, since the artist-entity migration, artist name via an `EXISTS`
subquery. Label was never added.

**Considered extending the generated `search_vector` column instead** (as
the bug report suggested) — not possible. The same wall the artist
migration already documented applies identically here: a Postgres
`GENERATED ALWAYS AS` column can only reference columns in its own row,
never a joined table, and `Product.labelId → Label.name` is a joined
table. The fix mirrors the artist `EXISTS` clause exactly, just against
`Label` directly (a simple FK, no join table needed, unlike artist's
many-to-many via `ProductArtist`):
```sql
OR EXISTS (
  SELECT 1 FROM "Label" l
  WHERE l.id = p."labelId"
    AND (l.name ILIKE ${like} OR l.name % ${term})
)
```
New migration `label_search_trgm`: `CREATE INDEX label_name_trgm_idx ON
"Label" USING GIN (name gin_trgm_ops)` — `pg_trgm` was already enabled by
`catalog_fuzzy_search`. Hand-written per this doc's own gotcha above;
`--create-only` proposed the usual drift (dropping the existing trigram
indexes and `search_vector`'s default), discarded in favor of just the
one new index.

**Verified live against Postgres** (same standard as the original
feature): searching `Warp`, `Warp Records`, `warp records`, and a typo'd
`wrap recrds` against real seeded data all correctly matched the one
product on "Warp Records".

**Noted, not fixed — same class of tradeoff as the original feature's
"bio"/"sphere" examples:** the `%` similarity operator can over-match
labels that share a common word. `similarity('Zulema Records', 'Warp
Records')` is `0.4` (above the `pg_trgm` default `0.3` threshold) purely
because both share " Records" — searching "Warp Records" also surfaces
products on "Zulema Records". This is the same operator already accepted
for title/artist fuzzy matching, applied consistently to a new field, not
a regression specific to this change.
