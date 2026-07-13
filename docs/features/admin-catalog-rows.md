# Admin catalog list: row layout with information hierarchy

The 10-column table forced horizontal scrolling to see all fields. The list is
now stacked rows where each product reads at a glance.

## Row anatomy

- **Line 1:** artist (bold) — title, truncated if long
- **Line 2:** label · genre · condition badge (NEW green / SECONDHAND neutral)
- **Line 3:** `Added <relative>` · `Updated <relative>` — full timestamp in the
  `title` attribute on hover. A recently changed *Updated* on an older
  *Added* is how you spot restocks.
- **Right side (desktop) / last line (mobile):** quantity ("N in stock", red
  at 0), price, Sell one, Edit, Delete.

No horizontal scrolling at any width; below the `md` breakpoint the row
stacks exactly as above.

Dropped from the list (still on the edit form): catalog number, product type.

## `lib/relative-date.ts`

- `relativeDate(date, now?)` — "just now", "N minutes/hours/days/weeks/
  months/years ago" (coarse buckets: 30-day months, 365-day years).
- `fullDate(date)` — "13 Jul 2026, 14:00", pinned to Europe/Amsterdam so
  hover titles read the same regardless of server locale.

## Tests

- `lib/relative-date.test.ts` — full behavioral coverage of both helpers,
  written before the implementation.
- `app/admin/catalog/catalog.test.tsx` — rows render artist, title, label,
  genre, condition, quantity, price, both relative dates (with `title`
  attribute) and the edit link.
