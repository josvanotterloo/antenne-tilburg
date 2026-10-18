# Reference-entity shared behaviour (Labels / Genres / Artists / Product Types)

**Status:** merged via `feature/reference-entity-shared`.

## Summary
STEP 5 of `docs/qa/claude-code-prompts-revised-5-6.md` (Unit 2), three
independent improvements landed on top of the shared
`components/admin/ReferenceSection.tsx` + `lib/reference-crud.ts` seam that
all four managed reference lists already used.

## 5a — Frontend behaviours
All three land in the one shared component, so all four entities get them at
once:
- **Search-into-add**: a search with no matches shows `Add "<term>"` (same
  click-to-create pattern as `Combobox.tsx`'s quick-add) instead of just "No
  matches."
- **Success confirmation**: create/rename show a brief `role="status"`
  message, cleared on the next search/action.
- **Clickable → admin product list**: each item's product count links to
  `/admin/catalog?<param>=<id>` (`lib/catalog.ts` already supported the
  `artistIds`/`genreId`/`labelId`/`productTypeId` filters; `app/admin/
  catalog/page.tsx` now reads one from the URL, applies it, and shows a
  "Filtered by {entity}: {name} · Clear filter" banner that pagination/search
  links preserve). `ReferenceSection` takes a new `productLinkParam` prop,
  set per entity in each of the four `page.tsx` files.

## 5b — Exact-duplicate blocking (app-level only)
Nothing previously blocked a near-duplicate name beyond the DB's
case-sensitive exact-string `@unique` — "Jeff Mills" and "JEFF MILLS" could
both exist. A DB-level unique index on a normalized name **cannot be added
yet**: the backfill (below) confirmed existing production data already has
case/`&`-variant duplicates (e.g. "BIOSPHERE"/"Biosphere", "BOB MARLEY & THE
WAILERS"/"...AND..."), which would fail a unique-index migration outright.

- `lib/reference-dedupe.ts`: `normalizeReferenceName` (lowercase, unify
  `&`/`and`, collapse whitespace, trim) + `findDuplicateByNormalizedName`.
  Shared by `lib/reference-crud.ts`'s factory (covers Genre/ProductType/
  Artist-create) and the bespoke Artist rename route (`app/api/admin/
  artists/[id]/route.ts`, after its existing Various-Artists-name guard) and
  bespoke Label routes (`app/api/admin/labels/route.ts`,`[id]/route.ts`).
- Schema: `normalizedName String @default("")` + a plain (non-unique) index
  per model. The existing `name String @unique` is untouched — still a free
  exact-string guard, and the `P2002` catch path is still reachable as a
  backstop against a same-instant race on the identical string.
- Migration `20261018182953_reference_normalized_name`: additive only
  (`ADD COLUMN ... DEFAULT ''` + `CREATE INDEX`), hand-trimmed per `tasks/
  lessons.md` (2026-07-08/17/29b) to drop the spurious trigram/search_vector
  drift lines `prisma migrate dev --create-only` always proposes in this repo.
- Backfill: `scripts/backfill-normalized-names.ts` (core logic in `lib/
  backfill-normalized-names.ts`) populates every existing row using the
  **real** `normalizeReferenceName` — deliberately not a second SQL
  reimplementation, so the backfilled value can never drift from what the
  app writes going forward (JS `toLowerCase()`/Postgres `lower()` don't
  always agree on non-ASCII, and these tables have plenty of diacritics).
- Follow-up tracked in `tasks/todo.md`'s Backlog: add the real
  `@@unique([normalizedName])` once the separate existing-duplicate merge
  task has run and verified zero remaining collisions.

## 5c — Fuzzy "did you mean" (Artists only)
- `lib/artist-fuzzy-match.ts`'s `findSimilarArtists` runs a pg_trgm `%`
  similarity query against `Artist.name` (same style as `lib/catalog.ts`'s
  `searchProductIds`), joined to `ProductArtist` for counts. Reuses
  `artist_name_trgm_idx`, which already existed from the artist-entity
  migration (`20260729121500_finalize_artist_entity`) — no new migration
  needed; found while trimming 5b's migration diff.
- `app/api/admin/artists/route.ts`'s `POST` runs this **after** the create
  (5b's exact-normalized-name check already passed) and adds `candidates` to
  the 201 response when non-empty. Never blocks — the artist is already
  created.
- `ReferenceSection.tsx` generically reads `created.candidates` and folds it
  into the success message (`Added "X". Did you mean: Y (12 products)?`) — a
  harmless no-op for the other three entities, whose create response never
  populates it.

## Verified live
Manual browser click-through against the real dev DB (not just the mocked
test suite) for both the shared-factory path (Artists) and a bespoke route
(Labels): search-into-add, success/rename messages, the product-count link
and the catalog filter banner + clear, exact-duplicate blocking (case
variant), and the fuzzy "did you mean" warning. Caught and fixed one real
issue in the process: the already-running dev server held a stale Prisma
Client from before the migration (`tasks/lessons.md` 2026-07-17b) — a 500 on
create until restarted.
