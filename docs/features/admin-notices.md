# Admin notices (CRUD slice 3)

**Status:** Merged to `master` (2026-07-04) · branch `feature/admin-notices`
(commits `d54b2e5`, `2a73d15`)

First slice of the **Settings** section.

## What's in place
- **`lib/notice.ts`** — `isNoticeActive(notice, now)` predicate +
  `activeNoticeWhere(now)` Prisma builder. `NoticeBanner` (public) refactored
  to reuse `activeNoticeWhere` — one source of truth for the active window.
- **`lib/notice-input.ts`** — `parseNoticeInput`: message required, active
  defaults true, optional start/end window, end-after-start validation.
- **API** (auth-gated): `GET/POST /api/admin/notices`, `GET/PATCH/DELETE /[id]`.
- **UI:** Settings sub-nav (Opening hours + Notices); `NoticeForm` (message,
  active, optional window); `NoticeActions` (activate/deactivate + delete);
  `/admin/settings/notices` list with a live **"showing now"** column derived
  from `isNoticeActive`. Removed the superseded `/admin/notices` placeholder.

## Correctness note
The display predicate and the query builder **agree at inclusive boundaries**
(startsAt ≤ now, endsAt ≥ now), so the admin "showing now" column matches what
the public banner actually renders.

## Tests & verification
- **147 tests**: isNoticeActive, activeNoticeWhere, parseNoticeInput, all
  routes, list render (live active/inactive).
- `tsc`/`lint`/`build` clean; pre-commit hook green.
- **Live (real Postgres) incl. public integration:** create active notice →
  appears on the homepage banner; deactivate → hidden; end-before-start → 400;
  delete → 200.

## Code review
No findings.

## Known gaps
- `toDateTimeLocal` is reused from `lib/event-input`; a shared `lib/datetime`
  home would be tidier.
