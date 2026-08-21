# Product ↔ Genre: many-to-many

## Summary

`Product.genreId` (a single required FK) became `ProductGenre`, an explicit
join table — the same pattern this app already used for `Product` ↔
`Artist` via `ProductArtist`. A product can genuinely belong to more than
one genre; the legacy dump already proved this (18% of legacy products had
a comma-separated `genre_id`, which the migration script used to truncate
to just the first — see `docs/features/legacy-migration.md`).

## Schema

```prisma
model ProductGenre {
  id        String  @id @default(cuid())
  productId String
  product   Product @relation(fields: [productId], references: [id], onDelete: Cascade)
  genreId   String
  genre     Genre   @relation(fields: [genreId], references: [id])
  position  Int     @default(0) // 0 = primary genre
  @@unique([productId, genreId])
  @@unique([productId, position])
  @@index([productId])
  @@index([genreId])
}
```

`Product.genreId` and its direct `genre` relation are gone; `Genre.products`
is gone too, replaced by `Genre.productGenres`. Migration
`20260821123237_product_genre_many_to_many` is hand-written (dropping a
column with non-null data makes `prisma migrate dev` refuse
non-interactively — see `tasks/lessons.md` 2026-07-29c): it creates
`ProductGenre`, backfills one row per existing product
(`gen_random_uuid()::text` for the id — a straight 1:1 column-to-join-row
copy needs no separate TypeScript backfill script, unlike the original
Artist entity migration, which had to parse a free-text string), then drops
the old column/FK/index in the same transaction, and adds a
`genre_name_trgm_idx` trigram index for search.

## Where this shows up

- **Admin form** (`ProductForm.tsx`): the Genre `Combobox` became a
  `MultiCombobox`, identical to how Artists already works — `genres:
  ComboboxOption[]` state, submits `genreIds: string[]`.
- **Admin list, public pages** (`/admin/catalog`, `/stock`,
  `/stock/[id]`, the home "Just In" list): all genres shown, joined with
  `" · "` via `lib/catalog.ts`'s new `joinGenreNames` (mirrors the existing
  `joinArtistNames`, which uses `" / "`).
- **`lib/dymo-label.ts`** (printed shelf label): shows only the **primary**
  (position 0) genre — physical label space is tight.
- **`lib/newsletter-arrivals.ts`**: groups by the **primary** genre.
  Dropped the DB-level `orderBy: [{ genre: { name: "asc" } }]` — Prisma
  can't sort by a to-many relation's field, and `groupArrivalsByGenre`
  already fully determines the final grouped order itself, so that clause
  was decorative, not load-bearing.
- **`app/api/catalog/route.ts`** (public JSON API): `genre: string` became
  `genres: string[]` — a deliberate interface change, exactly like this
  same file's existing precedent for `artists`.
- **`lib/rss.ts`**: stays decoupled from Prisma relation shapes (its own
  existing design) — `FeedProduct.genre: {name}` became `genreDisplay:
  string`, pre-joined by the caller the same way `artistDisplay` already is.
- **`lib/structured-data.ts`**: JSON-LD `category` is now
  `joinGenreNames(product.productGenres)`.
- **`lib/reference-crud.ts`**: `itemHandlers`'s `DELETE` in-use guard was
  hardcoded to `_count.products` — fine while every reference entity had a
  direct `products` relation, but Genre no longer does. Extended with the
  same `{ countField? }` option `collectionHandlers` already had (default
  `"products"`, so Label/ProductType/Supplier are unaffected); Genre passes
  `{ countField: "productGenres" }`. `app/admin/catalog/genres/page.tsx`
  got its own `toGenreItems` mapper, mirroring `artists/page.tsx`'s
  existing `toArtistItems` (same reason: a join-table count, not a direct
  relation count).
- **`lib/resolve-genres.ts`** (new): mirrors `lib/resolve-artists.ts`'s
  `resolveArtists` — validates every requested genre id still exists before
  a product write, not just the first.
- **`lib/product-input.ts`**: `parseArtistIds` generalized to `parseIdArray`
  (same validation, reused for both `artistIds` and the new `genreIds`).

## Verification

`npm run typecheck` — the primary correctness signal here, since removing
`Product.genreId` breaks every consumer at compile time until fixed (it
caught all of the above). Full test suite green (966/966). Manual browser
click-through: add/edit a product with 2+ genres via the multi-select,
confirm the admin list/print label/public pages all render correctly, and
that deleting an in-use Genre is still blocked (409) via the reference
page — confirmed via `POST`/`DELETE` against `/api/admin/genres`
directly, matching `countField: "productGenres"`.

### Unrelated bug found and fixed during verification

The `/admin/catalog/genres` page crashed at runtime
(`PrismaClientValidationError: take: [object Function]`), pre-existing on
`master` and affecting all four reference-list pages (Genres, Artists,
Labels, Product Types), not introduced by this branch. Cause:
`SEARCH_RESULT_CAP` and `toSimpleReferenceItems` were plain
value/function exports living in `components/admin/ReferenceSection.tsx`
(`"use client"`) — every export of a client-boundary module becomes an
opaque client reference when imported anywhere, including a Server
Component's own server-side logic, not just JSX props. Fixed by moving
both into a new plain module, `lib/reference-items.ts`, imported by both
the client component and all four server `page.tsx` files. See
`tasks/lessons.md` 2026-08-21c.
