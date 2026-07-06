# Remove want-list

**Status:** branch `feature/remove-want-list` — merged to `master` (2026-07-06).

## Summary
Removed the want-list feature surface. The `WantListRequest` model stays in the schema
(harmless, no migration), but there is no want-list UI.

## What changed
- Deleted `app/admin/want-list/page.tsx` (a placeholder that was **orphaned** — not
  linked from `AdminTopNav`, the Settings sub-nav, or anywhere else).
- No public want-list page existed, and `sitemap.ts`/nav never referenced it, so
  nothing else needed touching.
- `tasks/todo.md`: dropped the "Want-list / request form" backlog item and removed
  want-list from the Settings IA note.

## Kept
- `WantListRequest` model in `prisma/schema.prisma` (data is harmless; leaving it avoids
  a needless migration and keeps the option open).

## Tests
- 255 tests green; `tsc` + lint clean (nothing referenced the deleted page).
