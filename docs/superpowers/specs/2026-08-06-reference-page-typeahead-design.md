# Design: Reference Page Typeahead

Date: 2026-08-06

## Summary

`/admin/catalog/reference` currently renders all reference entries as flat
lists, fetched server-side with no limit. At production scale (55,295
artists, 10,484 labels, 132 product types, 90 genres) this is unusable —
both the page load (fetches every row) and the rendered list (every row in
the DOM). Upgrade each section to server-side typeahead, reusing the
existing `?q=` search endpoints the product-form combobox already relies
on. No new API routes.

## The scale bug is server-side too, not just the list rendering

`app/admin/catalog/reference/page.tsx` currently calls
`db.label.findMany({ orderBy, include: { _count: ... } })` with no `take` —
every row, for all four categories, on every page load. This is the same
class of problem the task describes for the client-rendered list, just one
layer earlier. Fixing only the client list would still load 55k artist rows
into the initial HTML. The initial server fetch changes to "first 20
alphabetically + a separate grand-total `count()`" — exactly the shape an
empty-query GET already returns, so the page loads instantly regardless of
table size and hydrates into the same state a fresh empty search would
produce.

## Product counts in search results

The existing `?q=` endpoints (`lib/reference-crud.ts`'s `collectionHandlers`,
shared by labels/genres/product-types, plus a matching GET on the artists
route) return `{ id, name }[]` only — no product count. The current
reference page uses that count for two things: displaying "In use by N
products" and hiding the Delete button when count > 0. Per the approved
design decision, this is preserved by extending the existing GET response
rather than changing the delete interaction:

- `ReferenceDelegate.findMany`'s args gain an `include: { _count: { select:
  Record<string, true> } }` option; its return rows gain `_count: Record<string,
  number>`.
- `collectionHandlers(delegate, opts?: { countField?: string })` — `countField`
  defaults to `"products"` (labels, genres, product types unchanged). GET's
  `findMany` now includes `_count: { select: { [countField]: true } } }`, and
  the response maps each row to `{ id, name, productCount: row._count[countField]
  }`.
- `labels/route.ts`, `genres/route.ts`, `product-types/route.ts`: unchanged call
  sites (default `countField` applies).
- `artists/route.ts`: passes `{ countField: "productArtists" }` — Artist's
  relation to Product is many-to-many via `ProductArtist`, not a direct FK,
  same distinction `page.tsx`'s existing `toArtistItems` mapping already
  makes today.

This is additive and non-breaking: the product-form `Combobox` (the other
consumer of these same endpoints) only reads `.id`/`.name` off each result
and ignores the new field.

## `ReferenceSection.tsx`

Gains, per section:

- A search `<input type="search">` above the list, `aria-label` per title
  (e.g. "Search labels").
- A 200ms-debounced fetch to `${endpoint}?q=<query>` on query change,
  sequence-guarded against out-of-order responses landing after a newer
  request (same race-condition-safe pattern as `components/ui/Combobox.tsx`,
  written independently rather than extracted into a shared hook —
  `Combobox`'s debounce logic is a private implementation detail of that
  component today, not an exported shared utility, so this isn't the same
  class of duplication as e.g. `lib/catalog.ts`'s `joinArtistNames`, which
  was already designated shared and had 8 existing callers).
- Initial `items` state comes from the `initialItems` prop (server-rendered
  first page) — the search effect does not re-fetch on mount (that would be
  a redundant duplicate of what SSR already produced) but does fire on every
  subsequent query change, including clearing back to an empty string.
- Total count: a new `initialTotal` prop seeds `totalCount` state, rendered
  as e.g. "10,484 labels". Kept in sync locally rather than refetched:
  +1 on a successful add, −1 on a successful delete, unchanged on rename.
- Add: unchanged endpoint/payload. The created item is spliced into the
  visible `items` list only if it matches the current query (case-insensitive
  substring, mirroring the server's `contains`/`insensitive` filter) or the
  query is empty — otherwise it exists (total count still increments) but
  isn't shown until the admin searches for it, matching what a fresh search
  for the current query would actually return from the server.
- Rename: unchanged endpoint/payload. The renamed item stays in place in the
  current results even if the new name would no longer match the active
  query — an admin who just renamed the item they were looking at shouldn't
  see it vanish out from under them mid-edit.
- Delete: unchanged endpoint/payload, decrements `totalCount` on success.

## `page.tsx`

- Each of the four `db.X.findMany` calls gains `take: 20` (dropping the
  unbounded fetch).
- Each gains a sibling `db.X.count()` call (all four run in the same
  `Promise.all`, 8 queries instead of 4 — cheap, indexed, no `where`).
- `ReferenceSection` gets two new props: `initialItems` (unchanged shape,
  now capped at 20) and `initialTotal` (the grand count).

## Testing

- `lib/reference-crud.test.ts`: existing GET tests updated for the
  deliberate contract change (`findMany` now called with `include`; mocked
  rows now carry `_count`; JSON response now carries `productCount`) — an
  approved interface change, not weakened assertions. New test: a custom
  `countField` maps to the right response field.
- `app/api/admin/reference-routes.test.ts`: same GET-response updates across
  all three resources sharing `collectionHandlers`.
- `app/api/admin/artists/route.test.ts` (new, or extend if one exists once
  checked during implementation): GET returns `productCount` sourced from
  `productArtists`, not `products`.
- `app/admin/catalog/reference/reference.test.tsx` (new): search input
  renders per section with the right `aria-label`; total count renders
  ("10,484 labels" etc.); typing updates results (debounced fetch, mocked);
  add/rename/delete still work against search results; a newly-added item
  not matching the active query isn't spliced into view but does bump the
  total; a rename that would stop matching the active query stays visible.
- `app/admin/catalog/reference/page.test.tsx` (new, or extend): the page's
  Prisma calls include `take: 20` and a parallel `count()`.

## Out of scope

- No changes to the product-form `Combobox`'s own debounce/fetch logic.
- No new API routes — only the existing four `?q=` GET handlers, extended.
- No schema changes.
