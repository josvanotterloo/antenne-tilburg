# Stock sections: This Week, Last Week, Back In Stock

Three public pages surfacing arrivals and restocks, driven entirely by the
existing `createdAt` / `updatedAt` / `quantity` fields — no schema changes.

## Queries (`lib/catalog.ts`)

- `weekRange(offsetWeeks, now)` — [Monday 00:00, next Monday 00:00) of the
  shop week in **Europe/Amsterdam** (`SHOP_TZ`), DST-safe, Monday midnight
  inclusive, injectable `now`. Weeks are shop-local on purpose: a record
  added Sunday 23:30 Tilburg time belongs to that week, whatever the server
  clock says.
- `getThisWeekProducts` / `getLastWeekProducts` — in-stock, `createdAt`
  within the current / previous shop week, newest first.
- `getBackInStockProducts` — in-stock, `quantity > 0`, `updatedAt` within
  `BACK_IN_STOCK_DAYS` (30), ordered by `updatedAt` desc, **excluding
  products whose `updatedAt` is within 60s of `createdAt`**. The epsilon
  implements the spec's "not a new product": on create the DB-set
  `createdAt` and client-set `updatedAt` differ by milliseconds, so a
  strict `>` would match every new arrival.

Accepted trade-offs: the back-in-stock query bounds at 100 rows before the
epsilon filter, and any admin edit (price fix, sell-one with stock left)
bumps `updatedAt` and surfaces the product — the spec explicitly treats
quantity updates and sell-one as the drivers.

## Pages

`/stock/this-week`, `/stock/last-week`, `/stock/back-in-stock` — one shared
`SectionPage` shell (heading, "← All stock" link, "Nothing yet." empty
state, `generateMetadata`, no pagination). Rows are the `/stock` row format
via the extracted shared `components/stock/ProductRow.tsx`, with an opt-in
condition display used by the section pages (artist, title, label, genre,
type, condition, price). `/stock` itself is unchanged apart from a
mono-label section-links row under the heading (chosen over main-nav
sub-items to keep the nav clean). All three are in the sitemap.

## RSS

`/stock/back-in-stock/feed.xml` — restocks, items dated by `updatedAt`.
XML rendering shared with the new-arrivals feed via `lib/rss.ts` (the
existing feed's test was untouched and stayed green through the refactor).
