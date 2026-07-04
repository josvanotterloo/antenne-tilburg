# Admin newsletter subscribers (CRUD slice 5)

**Status:** Merged to `master` (2026-07-04) · branch `feature/admin-subscribers`
(commits `47ea6c3`, `068ab0b`, `8470e46`)

Read-mostly: subscribers arrive via the public signup form (separate task).
Scope = view + CSV export + delete (delete added for unsubscribes).

## What's in place
- **`lib/csv.ts`** — `toCsv` serializer: RFC-4180 quoting/escaping (CRLF) **and
  formula-injection neutralization** (cells starting with `= + - @` tab/CR are
  quote-prefixed).
- **API** (auth-gated): `GET /api/admin/subscribers/export` (text/csv
  attachment), `DELETE /api/admin/subscribers/[id]` (404 on missing).
- **UI:** `/admin/settings/subscribers` list (name, email, signed-up, count)
  with an Export CSV download link and per-row Remove; added to Settings
  sub-nav. Removed the superseded `/admin/subscribers` placeholder.

## Tests & verification
- **170 tests**: toCsv escaping + formula-injection, export shape + 401,
  delete 200/404, list render.
- `tsc`/`lint`/`build` clean; pre-commit hook green.
- **Live (real Postgres):** admin page 200; unauth export → 401; CSV export
  with correct headers and comma-escaping (`"Lovelace, Ada"`); delete → 200,
  repeat → 404; test data cleaned up.

## Code-review fix (`8470e46`)
- **CSV formula injection:** user-submitted names starting with `=`/`+`/`-`/`@`
  are now quote-prefixed so they aren't executed as spreadsheet formulas.

## Notes
- The Export CSV link is a real `<a download>` to an API route (a file
  download), with a scoped eslint-disable for `no-html-link-for-pages` — a
  `<Link>` would client-navigate instead of downloading.
