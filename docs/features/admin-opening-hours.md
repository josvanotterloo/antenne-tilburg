# Admin opening hours (CRUD slice 4)

**Status:** Merged to `master` (2026-07-04) · branch
`feature/admin-opening-hours` (commits `b40f4ac`, `52bb06d`)

Base weekly grid only — holiday/adjusted overrides are deferred (future scope).

## Shape (differs from the other slices)
Not list+CRUD: a fixed set of 7 weekday rows (`dayOfWeek` unique), bulk-edited
in one form and saved together. No create/delete.

## What's in place
- **`lib/opening-hours.ts`** — `parseOpeningHoursInput` (HH:MM validation,
  close-after-open, closed-day time defaults), `DAY_NAMES`, `WEEK_ORDER`
  (Monday-first), `isValidTime`.
- **API** (auth-gated): `PUT /api/admin/opening-hours` upserts every submitted
  day in one `$transaction`.
- **UI:** `OpeningHoursForm` — 7 rows (Monday-first), closed toggle + time
  inputs, single save; `/admin/settings/hours` replaces the placeholder,
  fills defaults for any missing day. Removed the superseded
  `/admin/opening-hours` placeholder.

## Tests & verification
- **160 tests**: validation cases, PUT (upsert per row, 400, 401), page render
  (all 7 rows, closed-day disabled inputs).
- `tsc`/`lint`/`build` clean; pre-commit hook green.
- **Live (real Postgres) incl. public integration:** PUT Monday 10:00–20:00 →
  the homepage footer reflects `10:00–20:00`; close-before-open → 400; restore
  → 200.

## Code review
No findings.

## Known gaps
- Holiday/adjusted-day overrides deferred.
- `SiteFooter` still defines its own local day-name array — dedupe against
  `DAY_NAMES` when the public Visit page is built.
