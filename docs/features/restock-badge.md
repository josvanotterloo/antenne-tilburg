# RESTOCK badge on public stock pages

A RESTOCK badge, styled identically to the existing JUST IN badge, appears
on every public product listing that shows a `CatalogProduct`:

- `/stock` — both list view (`ProductRow`) and grid view (`ProductCard`)
- `/stock/this-week`, `/stock/last-week`, `/stock/back-in-stock` (via the
  shared `ProductRow`/`SectionPage`)
- `/stock/[id]` detail page

## Logic

Reuses the existing `isRestock` predicate from `lib/catalog.ts`
(`updatedAt` more than 60s after `createdAt`, `quantity > 0`) — no
duplicated restock logic. Same predicate that drives `/stock/back-in-stock`
and the newsletter's restock stars, so all three surfaces can never
disagree about what counts as a restock.

## Rendering when both JUST IN and RESTOCK apply

The task notes a product can't logically be both new and a restock in
practice, but asked for graceful handling if it ever occurs — e.g. a
product created and then edited again within the same session, or a
manual `createdAt` backdate. Both badges render side by side,
next to each other:

- `ProductRow` / detail page: each badge is its own inline `<span>` with
  its own left margin, so they simply flow one after another in text —
  no wrapper needed.
- Grid `ProductCard`: both badges are grouped inside one small flex
  container (`gap-1.5`) so the card's `justify-between` price row still
  sees exactly one element on each side, regardless of how many badges
  render.

Verified on the real dev DB: of five seeded products, three (touched since
creation via earlier admin edits/sell-one) show **both** Just In and
Restock together on their detail pages; two show only Just In. Confirms
badge presence isn't a blanket true-for-everything bug.

## Implementation note

`components/stock/ProductRow.tsx`'s `JustInBadge`/`RestockBadge` now share
one `badgeClass` string constant — extracted so "matching the existing
JUST IN badge styling" (the task's own requirement) is guaranteed by
construction rather than by copy-pasted class strings that could drift.
The grid `ProductCard` badge (a separate, pre-existing inline
implementation, not sharing `ProductRow`'s components) was updated to
match the same class string but is not itself deduplicated — pre-existing
duplication, out of scope for this task.
