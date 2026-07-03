# Admin blog posts (CRUD slice 1)

**Status:** Merged to `master` (2026-07-03) · branch `feature/admin-posts`
(commits `9eff832`, `1745cdd`, `233302f`)

First of the Admin CRUD slices. Establishes the Content section IA and the
post management flow.

## What's in place
- **`lib/slug.ts`** — `slugify` (strip diacritics, collapse non-alphanumerics);
  shared with Events (slice 2).
- **`lib/post-input.ts`** — `parsePostInput`: title + body required, slug
  derived from an explicit slug or the title (falls back to the title if the
  explicit slug is unsluggable), status DRAFT/PUBLISHED.
- **API** (auth-gated): `GET/POST /api/admin/posts`, `GET/PATCH/DELETE /[id]`.
  `publishedAt` is stamped the first time a post goes live and preserved
  thereafter; duplicate slug → 409; missing record → 404.
- **UI:** `AdminSubNav` (reusable section sub-nav) + Content section layout;
  `/admin/content/posts` list (status badge, publish/unpublish toggle,
  two-click delete); `new` + `[id]/edit` form pages; `PostForm` client
  component.

## IA decision
Admin nav has three sections; this slice populates **Content** (Blog posts;
Events next). **Settings** will hold opening hours, notices, subscribers, want
list, users.

## Tests & verification
- **108 tests** (Vitest): slugify, parsePostInput (incl. slug fallback), all
  post routes (list/create/publish-stamp/409/404/delete), list-page render.
- `tsc`/`lint`/`build` clean; pre-commit hook green.
- **Live end-to-end (real Postgres):** unauth API → 401; create PUBLISHED →
  201 with derived slug + stamped publishedAt; duplicate slug → 409;
  unpublish → 200; delete → 200.

## Code-review fix (`233302f`)
- Slug fallback: a garbage explicit slug no longer blocks a save when the
  title yields a valid slug.

## Known gaps / not done (noted, not fixed — proportionate to shop-blog scale)
- Publish toggle re-sends the full post via PATCH and ships each post's body to
  the client for the list row; a status-only publish endpoint would be leaner.
- Posts list uses an unbounded findMany (fine for a shop blog; the catalog is
  paginated if the blog ever grows).
- No public blog rendering yet (that's a separate public-pages task).
