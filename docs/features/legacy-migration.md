# Legacy MySQL → PostgreSQL data migration

**Status:** script only — **not yet run against the real database**.
`scripts/migrate-legacy-data.ts` + `lib/mysql-dump-parser.ts`.

## Summary

One-time import of the old Antenne PHP/MySQL system's `antenne_product`
database (a phpMyAdmin/MariaDB dump) into this app's PostgreSQL database via
Prisma. Covers Supplier, Genre, ProductType, Label, Artist, Product,
ProductArtist (from the legacy `contents` table), StockTransaction (from
`stock_txn`), and Post (from `blog`).

## How to run

```
npx tsx scripts/migrate-legacy-data.ts /path/to/dump.sql --dry-run   # always first
npx tsx scripts/migrate-legacy-data.ts /path/to/dump.sql             # writes to the DB
```

Dry run connects to the database **read-only** (to compute what already
exists, for idempotency) and reports every count without writing anything.
Always run it first and read the skip log before running for real.

## Expected row counts

Verified against the dump at `/Users/josvanotterloo/Downloads/_Antenne_Database_.sql`
(phpMyAdmin export, 29 Jul 2026, MariaDB 10.6.20). **These are the dump's
actual counts, not the original task estimate** — see "Corrections" below;
Supplier and StockTransaction happened to match the original estimate
exactly, the rest didn't.

| Table | Rows in dump |
|---|---|
| supplier | 35 |
| genre | 72 |
| producttype | 118 |
| label | 10,296 |
| artist | 38,766 |
| product | 46,692 |
| contents (→ ProductArtist) | 27,004 |
| stock_txn | 44,653 |
| blog (→ Post) | 962 |

Against an empty target database, a real run should report roughly:
33 suppliers created (1 blank name skipped), 64 genres (8 already seeded by
`prisma/seed.ts`), 111 product types (7 overlap with the seed list), 10,271
labels (13 merged duplicate names, 7 blank names, 5 seed overlap), 38,761
artists (4 merged duplicate names, 1 blank name), 46,616 products (76
skipped — see below), 66,966 ProductArtist links, 44,594 stock transactions
(59 skipped), 959 posts (3 blank-title skipped). Run the dry run against
your actual target DB for exact numbers — pre-existing seeded/admin data
changes the "created" counts without changing what's in the dump.

## Corrections to the original task spec (verified against the real dump)

The task's field-mapping prose didn't fully match the actual dump. Each of
these was found by inspecting the dump directly before writing any parsing
code, not by trusting the spec:

- **`label` has no `supplier_id` column at all.** Only `id` and `name`.
  `Label.supplierId` is `null` for every migrated label — that FK only
  exists on `product` in the legacy schema.
- **`blog.picture` is a foreign key into `blog_img.id`, not a filename.**
  `blog_img.file_name` holds the real filename. The script joins
  `blog.picture` → `blog_img.id` → `file_name`.
- **`blog.act_ind` is `'Y'`/other (char), not `1`/`0`.** Every row in this
  dump is `'Y'`. Mapping: `'Y'` or `'1'` → `PUBLISHED`, anything else →
  `DRAFT`.
- **`product.genre_id` is a `varchar` that can hold a comma list** (e.g.
  `'17,57'`) — 8,453 of 46,692 products (18%) have more than one. Per
  product-owner decision: the first id is kept, the rest dropped (the new
  schema has one required `genreId`, not many). Flagged as a simplification
  that may be revisited.
- **`stock_txn.txn_type` has a third value: `''`** (blank), on roughly a
  third of rows — not just `IN`/`OUT`. Per product-owner decision: blank →
  `OUT` (same shape as surrounding OUT rows — qty 1, realistic sale
  prices — from before the field was consistently populated).
- **`product.lastchange` defaults to `19001231`**, a "never changed"
  sentinel (matching `instockdate_old`'s declared default
  `'1900-01-01'`) — not a real date. Treated as "no known update":
  `Product.updatedAt` falls back to `createdAt` instead of becoming a
  literal 1900-12-31 date, which would make `updatedAt < createdAt` and
  corrupt `lib/catalog.ts`'s `isRestock` math.
- **`product.instockdate` is `0`** for a small number of rows — a second,
  distinct "unknown" sentinel. Falls back to `lastchange` when
  `instockdate` doesn't parse. Every product in this dump has at least one
  of the two parseable.
- **`contents` has no explicit ordering column.** Its own `id` is an
  auto-increment surrogate key; sorting by `id` ascending within each
  `prod_id` group reconstructs the original insertion order used for
  `ProductArtist.position`.
- **`product.description` wasn't mentioned in the original mapping** (not
  in the "map" list or the "drop" list) — included anyway since it's an
  obvious 1:1 field the omission looks accidental, and dropping real
  shop-written descriptions would be a real, avoidable loss.

## ProductArtist / isVariousArtists resolution

- If a product has ≥1 `contents` rows, its `ProductArtist` links are
  **exactly** those rows (ordered by `contents.id`) — `product.artist_id`
  is ignored entirely. Confirmed: the legacy placeholder artist id used on
  VA-style products (id 6) is literally named `'VARIOUS ARTISTS'` in the
  legacy `artist` table; the real per-track artists live only in
  `contents`.
- If a product has 0 `contents` rows, its single link comes from
  `product.artist_id`.
- `isVariousArtists = true` iff the contents-row count is ≥ 2. Exactly one
  `contents` row still uses that row as the sole artist but stays
  `isVariousArtists: false`.
- `primaryArtistName` is always the resolved position-0 artist's name. A
  product whose artist can't be resolved at all is skipped and logged
  (`Product.primaryArtistName` is required).

## Idempotency

- **Reference tables** (Supplier/Genre/ProductType/Label/Artist): matched
  by name (case-sensitive, post-normalization) against what's already in
  the DB, bulk-fetched once per table. A legacy row whose name already
  exists reuses that row's id.
- **Product**: no legacy-id column exists in the new schema to key off
  (adding one would be a schema change beyond this script's scope).
  Matched on `title + primaryArtistName + labelId + catalogNumber` — an
  extension of the heuristic `prisma/seed.ts` already uses for its own
  sample-product idempotency, not a true unique key. `catalogNumber` had
  to be added to the key during implementation: title+artist+label alone
  produced 377 false-positive collisions (generic titles like `"untitled"`
  shared by genuinely different catalog-numbered releases — verified by
  inspecting the colliding rows' actual `labelcode`/price/date, which all
  differed). Adding `catalogNumber` dropped that to 53, which do look like
  genuine re-entries of the same catalog number.
- **ProductArtist**: re-run safe via `skipDuplicates: true` (the schema's
  own `@@unique([productId, artistId])` / `@@unique([productId, position])`
  constraints do the real work).
- **Post**: matched by a deterministic slug (title, then `+ date` if that
  collides, then `+ legacy id` if that still collides — nearly every
  legacy post is titled `"New Arrivals"`, so the base slug collides almost
  always).
- **StockTransaction**: **no dedup key at all.** Running this script twice
  against a database that already has migrated data will duplicate stock
  history. This is a one-shot import, not a repeatable sync — plan for a
  single real run.

## What was dropped, and why

- `barcode`, `subtitle`, `stk_home`, `ownrelease`, `hints`, `genre_id_old`,
  `instockdate_old` — per the original spec; no equivalent field in the new
  schema, or superseded by another column that is migrated.
- `maint_users` — the new `User` table has its own seed (real admin
  passwords, not a legacy carryover).
- `navigation` — hardcoded in the new site.
- `log` — replaced by `StockTransaction`.
- `stk_location` — dropped; the new schema has no multi-location concept.
- `tmp_test` — a scratch table, not real data.
- `blog_img` — not migrated as its own entity; only its `file_name` is
  used (via the join described above) to populate `Post.coverImage`. The
  actual image files themselves aren't copied by this script — see
  "Verification" below.

## Verification steps (after a real run)

1. Re-run with `--dry-run` against the now-populated DB — every table
   should report `0 created` / all rows "matched existing" (Product) or
   resolved to existing ids (reference tables), confirming nothing would
   double-import.
2. Compare row counts: `SELECT COUNT(*) FROM "Product"`,
   `"Artist"`, `"Label"` etc. against the "created" figures above plus
   whatever pre-existed.
3. Spot-check a few known releases in the admin catalog UI — search for a
   familiar artist/label, confirm the release, price, and stock quantity
   look right.
4. Check `docs/features/order-transaction-redesign.md`'s existing
   `scripts/backfill-stock-opening-balance.ts` for any products whose
   migrated `quantity > 0` but have zero `StockTransaction` rows (can
   happen if a product's entire legacy stock_txn history failed FK
   resolution) — run it after this import to give those an opening-balance
   transaction.
5. Cover images (`Product.coverImage`, `Post.coverImage`) are migrated as
   **filenames only** — the actual image files need to be copied from the
   legacy system's upload directory into this app's `public/uploads`
   separately; nothing renders until that happens.
6. Added to `tasks/todo.md`: verify product count, artist count, and label
   count against the old system directly (not just internal consistency).

## Skipped rows

The script logs a per-table count plus up to 20 example reasons at the end
of every run (dry or real). Every skip in the reference dump falls into one
of: blank required name/title in the source data, an unresolvable required
FK (deleted/never-existed legacy id), or a duplicate-key match (product
already imported, or a same-day-generated blog slug that collided).
