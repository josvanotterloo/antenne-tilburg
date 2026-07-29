# Artist entity migration

**Status:** branch `feature/artist-entity`.

## Summary
`Product.artist` (a plain `String`) is replaced with a proper `Artist`
entity, ordered many-to-many with `Product` via an explicit `ProductArtist`
join — real stock includes splits, compilations, and collaborations with
more than one artist per release. Touches the data model, a Postgres
full-text search column, admin CRUD, the product form, seven public
rendering surfaces, both RSS feeds, the newsletter, SEO, and the full test
suite.

## Design decision: explicit join, not implicit
The original spec called for an implicit m2m join table, but Prisma's
implicit join tables can't carry an ordering column — there'd be no
reliable "first artist" for display or sort. Resolved (user choice) in
favor of an explicit `ProductArtist { productId, artistId, position }`
model, plus a denormalized `Product.primaryArtistName` (always the
position-0 artist's name) so catalog sort and full-text search don't need
a per-row join/aggregate.

```prisma
model Artist {
  id             String          @id @default(cuid())
  name           String          @unique
  productArtists ProductArtist[]
}

model ProductArtist {
  id        String  @id @default(cuid())
  productId String
  product   Product @relation(fields: [productId], references: [id], onDelete: Cascade)
  artistId  String
  artist    Artist  @relation(fields: [artistId], references: [id])
  position  Int     @default(0)

  @@unique([productId, artistId])
}
```

## Migration + backfill sequencing
Mirrors the `emailHash` nullable→backfill→`NOT NULL` pattern from
`email-encryption-at-rest.md`, and the mandatory `prisma migrate dev
--create-only` + hand-edit workflow for this repo's hand-written
`search_vector`/trigram migrations (`fuzzy-search.md`; `tasks/lessons.md`
2026-07-08/2026-07-17).

1. **`add_artist_entity`** (additive): creates `Artist` + `ProductArtist`;
   adds `Product.primaryArtistName` nullable; leaves `artist` (made
   nullable, not dropped yet), `search_vector`, and the old
   `product_artist_trgm_idx` untouched.
2. **Backfill** — `lib/backfill-artists.ts` (pure, injected delegate,
   mirrors `lib/encrypt-legacy-subscribers.ts`) + `scripts/backfill-artists.ts`
   (thin wrapper). For each product: trims the legacy `artist` string,
   dedupes case-insensitively against `Artist` rows created earlier in the
   same run (first-encountered casing becomes the canonical name), creates
   the `Artist`(s) if new, then links each `ProductArtist` and sets
   `primaryArtistName` in a single `db.$transaction` (`linkAndSetPrimaryArtist`)
   — both writes land together or neither does, so a mid-run crash can never
   leave a product with one but not the other. Idempotent (skips products
   that are fully done — linked *and* named) and reports a
   `remainingWithoutArtist` count that itself checks both conditions, not
   just link existence, so a product left half-migrated by any prior partial
   run is still caught. The script reads the legacy `artist` column via
   `$queryRaw`, not the typed Prisma Client — `artist` is dropped from
   `schema.prisma` by the next migration, so a typed `select` would stop
   compiling; raw SQL keeps this script valid and re-runnable against any
   database still at the `add_artist_entity` state (the completion check
   uses `$queryRaw` for the same reason: `primaryArtistName` is typed
   non-null in the finalized schema, so the generated client's filter type
   won't accept `IS NULL`).
3. **`finalize_artist_entity`** (breaking, run only after the backfill
   confirms zero unlinked products): `primaryArtistName SET NOT NULL`;
   redefines `search_vector` as `GENERATED ALWAYS AS (to_tsvector('english',
   coalesce(title,'') || ' ' || coalesce(description,''))) STORED` (artist
   dropped — see Search below); drops `product_artist_trgm_idx`, creates
   `artist_name_trgm_idx` on `Artist.name`; drops `Product.artist`.

Verified live against the local dev Postgres: `scripts/backfill-artists.ts`
linked all 5 pre-existing products (5 new `Artist` rows, re-run reported
`0 linked, 0 created`), then `finalize_artist_entity` applied cleanly.

## Search: why artist left the generated column
A `GENERATED ALWAYS AS` column can't reference a joined table — not a
choice, a hard Postgres constraint. `search_vector` now covers `title` +
`description` only; artist matching moved to a correlated `EXISTS`
subquery against `ProductArtist`/`Artist` in `searchProductIds`
(`lib/catalog.ts`), with the trigram index moved from `Product.artist` to
`Artist.name` (a much smaller table):

```sql
SELECT id FROM "Product" p
WHERE p.search_vector @@ websearch_to_tsquery('english', ${term})
   OR p.title ILIKE ${like} OR p.title % ${term}
   OR EXISTS (
     SELECT 1 FROM "ProductArtist" pa JOIN "Artist" a ON a.id = pa."artistId"
     WHERE pa."productId" = p.id AND (a.name ILIKE ${like} OR a.name % ${term})
   )
```

Verified live: searching `?q=Surgeon` (the *secondary*, non-primary artist
on the seeded "Frequencies Split" fixture) correctly returns that product.

## Deliberate interface changes
Flagged explicitly per this repo's Test Contract (interface changes are
architectural decisions, not silent test rewrites):
- **Public catalog API** (`app/api/catalog/route.ts`): `artist: string` →
  `artists: {id, name}[]` (ordered) — see `docs/features/catalog-api.md`.
- **`/stock?artist=` query param**: name-based → id-based (`lib/catalog.ts`'s
  `stockArtistHref`, `CatalogFilters.artistIds`). Ids are stable across
  artist renames, which names aren't. A bookmarked/shared link in the old
  `?artist=<name>` form now matches nothing instead of erroring — accepted,
  since there are no documented external consumers of this URL scheme
  either, matching the catalog-API call above it.

## Decision: backfill splits composite legacy strings on `" / "`
`lib/backfill-artists.ts` splits each product's legacy `artist` string on a
literal `" / "` (space-slash-space) — `"Jeff Mills / Surgeon"` becomes two
linked `Artist` rows (`Jeff Mills` at position 0/primary, `Surgeon` at
position 1), matching the real convention this shop's legacy data used for
splits/comps/collaborations. The delimiter is deliberately the
space-padded form, not a bare `/`: a bare-`/` split would corrupt real
single-artist names that contain a slash without surrounding spaces (e.g.
`"AC/DC"`), which `" / "` leaves untouched since there's no space on either
side of its slash. A blank/whitespace-only legacy value still becomes a
single blank-named `Artist` (unchanged, pre-existing behavior — a separate,
not-yet-fixed gap; the app's own input validation has always rejected blank
artist input going forward, so this only affects already-bad legacy rows).
If a future external data import (e.g. a Discogs migration) uses a
different delimiter convention, that's a new, separate parsing decision —
not a change to this script.

## Touch points
- **Admin CRUD:** `app/api/admin/artists/route.ts` reuses
  `lib/reference-crud.ts`'s `collectionHandlers` verbatim for GET
  (typeahead) + POST (create) — those never touch the relation shape.
  `[id]/route.ts` is bespoke: rename (PATCH) also refreshes
  `primaryArtistName` on any product where this artist is position-0
  (wrapped in `db.$transaction`); the delete guard counts through
  `_count.productArtists` instead of a direct FK count.
- **Product form:** new `components/ui/MultiCombobox.tsx` (chips, quick-add,
  server typeahead) — not folded into the existing single-select
  `Combobox.tsx`, which 3 other fields and their tests rely on staying
  single-select.
- **`lib/product-input.ts`:** `artistIds: string[]` replaces `artist:
  string`; `toProductData` takes an explicit `{ primaryArtistName, mode }`
  (mode picks `create` vs `update`'s nested-write shape — `deleteMany` is
  only valid on update, full-set replacement each save).
- **Public rendering:** one shared `joinArtistNames` helper
  (`lib/catalog.ts`) used by the stock listing, detail page, home "Just
  In", both RSS feeds, structured data, and the newsletter. `CATALOG_INCLUDE`
  gained `productArtists` — the type change was the mechanism for finding
  every remaining call site via `tsc --noEmit`.
- **Public catalog API** (`app/api/catalog/route.ts`): `artist: string` →
  `artists: {id, name}[]` — a deliberate, flagged interface change (no
  documented external consumers yet).
- **Newsletter:** sort key changed from `artist` to `primaryArtistName`
  (single stable key); the rendered line uses the joined display string.

## Tests & verification
662 tests green (91 files), `tsc`/lint clean. New: `lib/backfill-artists.test.ts`
(dedup, idempotency, zero-unlinked invariant), `app/api/admin/artists/[id]/route.test.ts`
(rename side-effect, delete guard), `components/ui/MultiCombobox.test.tsx`,
extended `ProductRow`/`product-input`/`catalog`/`newsletter-arrivals` tests
for multi-artist cases. Live-verified: backfill against real dev data,
search by secondary artist, RSS/JSON-LD/catalog-API rendering of the
"Frequencies Split" split fixture added to `prisma/seed.ts`.
