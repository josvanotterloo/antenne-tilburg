# Persistent stock navigation

`components/stock/StockNav.tsx` — one nav bar across all stock surfaces:
ALL STOCK · THIS WEEK · LAST WEEK · BACK IN STOCK, mono uppercase labels per
DESIGN.md. The active section carries `aria-current="page"` and the signal
underline (`decoration-signal underline-offset-4`), matching the sort-link
idiom already on /stock. Pages pass their section key; no client-side
route sniffing.

- `/stock` renders the nav with the search form in its right-hand slot
  (children). On small screens the form wraps below the links onto its own
  row. Filter-preserving hidden inputs unchanged.
- The three section pages render the nav without the search slot — they
  don't support filtering, so no dead search box. Their "← All stock" back
  link is gone; the nav's ALL STOCK link replaces it (the original
  back-link test passes unchanged against the new markup).

## Tests

- `components/stock/StockNav.test.tsx`: four links with correct hrefs,
  exactly one `aria-current` per active state, children slot renders.
- Page-level: /stock shows the nav (All Stock current) + searchbox; each
  section page shows the nav (own section current) and **no** searchbox.
- The stock page/section tests' `next/link` mocks now forward rest props —
  they previously swallowed `aria-current`.
