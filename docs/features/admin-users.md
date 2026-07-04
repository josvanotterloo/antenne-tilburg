# Admin users (CRUD slice 6 — final)

**Status:** Merged to `master` (2026-07-04) · branch `feature/admin-users`
(commits `fa89700`, `fd167b7`)

The auth-sensitive slice: manage the two equal admin accounts. No create/delete.

## What's in place
- **`lib/user-input.ts`** — `parseEmailChange` (valid, normalized lowercase) +
  `parsePasswordChange` (current required, new ≥ 8 chars, **not trimmed**).
- **API** (auth-gated, `passwordHash` never selected/returned):
  - `GET /api/admin/users/[id]` (hash-free select), `PATCH` (email change,
    409 on duplicate, 404 on missing).
  - `PUT /api/admin/users/[id]/password` — verifies the **current** password
    via bcrypt `compare` (403 if wrong, no write), then stores a new bcrypt
    hash (12 rounds, matching the seed).
- **UI:** `/admin/settings/users` list; `/[id]` manage page with `EmailForm`
  and `PasswordForm` (current + new password inputs). Added to Settings
  sub-nav. Removed the superseded `/admin/users` placeholder.

## Security decisions
- Password change requires the current password (per the agreed scope) — a
  hijacked session can't silently rotate credentials without it.
- Equal access: either admin can manage either account (spec: two equal
  admins). Email change is unique-guarded (409).
- `passwordHash` is never exposed by any route or page.

## Tests & verification
- **187 tests**: parseEmailChange, parsePasswordChange, GET/PATCH (incl.
  hash-free select, 409, 404), PUT password (verify-current 200, wrong-current
  403 no-write, short-new 400, missing 404), list render (hash-free select).
- `tsc`/`lint`/`build` clean; pre-commit hook green.
- **Live end-to-end (real Postgres):** email invalid→400, taken→409; password
  wrong-current→403, correct→200; **after change the old password fails login
  and the new one works**; then restored to the seed credential
  (`changeme123`) so the DB is back to its original state.

## Code review
No findings.
