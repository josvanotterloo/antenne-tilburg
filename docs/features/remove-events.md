# Remove events

**Status:** branch `feature/remove-events` — merged to `master` (2026-07-08).

## Summary
The events feature is removed entirely. It was already dropped from the public site
(`public-surface-trim.md`, 2026-07-04); this removes the remaining admin CRUD, model,
and routes. Notices cover one-off announcements.

## What was removed
- **Admin pages:** `app/admin/content/events/*` (list, new, `[id]/edit`) and the
  standalone `app/admin/events` placeholder.
- **API:** `app/api/admin/events/*` (collection + item routes + tests).
- **Components/lib:** `components/admin/EventForm.tsx`, `lib/event-input.ts` (+tests).
- **Model:** `Event` model + `EventStatus` enum, dropped via migration
  `20260708150000_remove_events` (`DROP TABLE "Event"; DROP TYPE "EventStatus"`).
- **Nav:** the "Events" item in the admin Content sub-nav.
- **Docs:** deleted `admin-events.md`; removed event references from the sitemap
  comment and `tasks/todo.md`.

## Kept / relocated
- `toDateTimeLocal` (a generic datetime-local formatter, not event-specific) moved
  from `lib/event-input.ts` to **`lib/datetime.ts`** — still used by the notices
  edit form.
- Notices are unchanged and remain the mechanism for one-off announcements.

## Tests & verification
- **Guard test** `no-events.test.ts`: asserts the event routes/components/lib files
  are gone, the schema has no `Event` model / `EventStatus` enum, and the Content nav
  has no Events entry. Written first (failed), then made green by the removal.
- **331 tests green**, `tsc` clean (after `rm -rf .next` to clear stale route types),
  lint clean, `next build` passes. `prisma migrate status` up to date.

## Note
Historical session logs and past feature docs (e.g. `public-surface-trim.md`,
`001-initial-scaffold.md`) still mention events as a *past* state — left as-is since
they record what happened at the time, not the current feature set.
