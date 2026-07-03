# Admin events (CRUD slice 2)

**Status:** Merged to `master` (2026-07-03) · branch `feature/admin-events`
(commits `9c98d20`, `c105a14`, `dfa7b29`)

## What's in place
- **`lib/event-input.ts`** — `parseEventInput` (title + valid date required,
  slug derived w/ title fallback, default location), `eventStatus(date)`
  deriving UPCOMING/PAST, and `toDateTimeLocal` (datetime-local formatting).
- **API** (auth-gated): `GET/POST /api/admin/events`, `GET/PATCH/DELETE /[id]`.
  Status is recomputed from the date on every write; slug 409; missing 404.
- **UI:** reusable `DeleteButton`; `EventForm` (datetime-local input);
  `/admin/content/events` list with date + **live-derived** status badge (not
  the stored value, so it never goes stale); new + edit pages; Events added to
  the Content sub-nav.

## Design decisions
- **Status is derived from the date**, not a manual toggle. The stored
  `status` column is written for convenience but the UI derives live via
  `eventStatus(date)`.

## Tests & verification
- **127 tests**: parseEventInput, eventStatus, toDateTimeLocal round-trip, all
  event routes, list render (live status derivation).
- `tsc`/`lint`/`build` clean; pre-commit hook green.
- **Live (real Postgres):** unauth API → 401; create future → UPCOMING (slug
  derived, location defaulted); PATCH to a past date → PAST; delete → 200.

## Code-review fix (`dfa7b29`)
- **Timezone drift:** the edit form formatted the date as UTC while the API
  parses datetime-local as local, so each edit-save shifted the event by the tz
  offset. Fixed with `toDateTimeLocal` (local components) + a round-trip test.

## Known gaps / not done
- No public events page yet (separate public-pages task).
- datetime-local assumes the admin's browser tz matches the server tz (true for
  a single-location Tilburg shop); a multi-tz setup would need explicit tz
  handling.
