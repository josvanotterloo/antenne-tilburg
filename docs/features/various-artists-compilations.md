# Various Artists / compilation support

**Status:** merged via `feature/various-artists-support`.

## Summary
Adds a VA/compilation flag to `Product` so records with no single headline
artist (label samplers, splits with more than a couple of names) link to one
shared `Artist` entity named "Various Artists" instead of the wrong single
artist, plus a free-text `contents` field listing who's actually on the
release. Search matches names typed into `contents` the same way it matches
a real linked artist's name.

## Data model
`Product.isVariousArtists` (`Boolean @default(false)`) and
`Product.contents` (`String?`). Additive migration, no backfill. `contents`
is also folded into the generated `search_vector` tsvector (title +
description + contents) and gets its own trigram GIN index
(`product_contents_trgm_idx`) for partial/fuzzy matching — see migration
`20260820185021_add_various_artists_support`, hand-trimmed per
`tasks/lessons.md` (2026-07-08/17/29b) since the generated column and
trigram indexes can't be modeled in `schema.prisma`.

## The shared "Various Artists" entity
`lib/resolve-artists.ts`'s `resolveVariousArtists` is the single source of
truth for the entity's name (`VARIOUS_ARTISTS_NAME`) and does a find-or-create
`upsert` — used by both product routes (so the entity is created on first
VA save in any environment, not just a seeded one) and `prisma/seed.ts`.

`PATCH /api/admin/artists/[id]` refuses to rename this specific entity
(400) — renaming it via the generic artist admin would leave
`resolveVariousArtists`'s fixed-name lookup unable to find it, silently
forking existing VA products (still pointing at the renamed row) from every
new VA product (which would upsert a second, disconnected entity).

## API
`parseProductInput` skips the "at least one artist" requirement when
`isVariousArtists` is true (the client sends no `artistIds`) and forces
`contents` to `null` whenever `isVariousArtists` is false, even if a client
sends one. `POST`/`PATCH /api/admin/products` resolve the real artist link
server-side — `resolveVariousArtists` for VA products, the existing
`resolveArtists` lookup otherwise — never trusting a client-supplied VA
artist id directly.

## Admin form
`ProductForm`'s "Various Artists / Compilation" checkbox hides the artist
`MultiCombobox` and shows an "Artists on this release" textarea
(`contents`) when checked; unchecking clears `contents` and empties the
artist selection, so the admin must pick a real artist before saving (the
combobox's existing `required` validation already enforces that).

## Public site
- `/stock` (New Arrivals list): VA products show the literal string
  `VARIOUS ARTISTS` in place of the joined artist name; no `contents` in
  list view (`components/stock/ProductRow.tsx`).
- `/stock/[id]` (detail): header reads "Various Artists — Title" for free
  (via the linked entity); `contents` renders as its own line between the
  header and the label/genre/type line when set.

## Deliberately out of scope
Per the original spec: the admin catalog list, `/api/catalog`,
`productJsonLd` structured data, the `/stock/feed.xml` RSS feed, the
homepage "Just In" list, newsletter arrivals, and the printed Dymo shelf
label all keep rendering the shared entity's plain name (or nothing) — none
were asked for, and the shelf label in particular was an explicit "leave
as-is" call during `/code-review` (small physical label, `contents` can be a
follow-up if it turns out to matter).
