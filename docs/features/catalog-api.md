# Public catalog API (`/api/catalog`)

**Status:** branch `feature/public-catalog-api` (2026-07-21).

## Summary
A public, unauthenticated JSON feed of in-stock products, for AI shopping agents and
other machine consumers that shouldn't have to scrape `/stock`.

## Endpoint

`GET /api/catalog`

No authentication required.

### Query params

| Param | Type | Default | Notes |
|---|---|---|---|
| `genre` | string | — | Matches `Genre.name`, case-insensitive. Unknown genre → empty `products`. |
| `condition` | `NEW` \| `SECONDHAND` | — | Any other value is silently ignored (no 400) rather than rejecting an agent's guess. |
| `limit` | number | 100 | Clamped to 1–500. |

### Response shape

```json
{
  "products": [
    {
      "id": "...",
      "artist": "Biosphere",
      "title": "Substrata",
      "label": "Dirty Carpets",
      "catalogNumber": "DC001",
      "genre": "Ambient",
      "productType": "LP",
      "condition": "NEW",
      "price": "12.99",
      "currency": "EUR",
      "inStock": true,
      "isRestock": false,
      "url": "https://antenne-tilburg.nl/stock/[id]",
      "createdAt": "2026-07-01T10:00:00.000Z"
    }
  ],
  "total": 5,
  "generatedAt": "2026-07-21T10:00:00.000Z"
}
```

- `total` is the full count of matching in-stock products, independent of `limit` —
  callers can tell there are more results beyond a truncated `products` array. Same
  semantics as `total` in `getCatalogPage` (`lib/catalog.ts`).
- Only `inStock: true` products are returned.
- `isRestock` uses the same 60-second creation/update epsilon as `lib/catalog.ts`
  (`isRestock`) — a restock is a product touched meaningfully after creation with
  stock remaining.
- `url` is built from `NEXTAUTH_URL` (falls back to `http://localhost:3000`), same
  convention as `app/sitemap.ts`.
- Sorted newest-first (`createdAt desc`, `id asc` tiebreaker for deterministic
  ordering when several products share a timestamp), matching the home page's
  "Just In" feed.
- `Cache-Control: public, max-age=300` — a 5-minute public cache, since the feed is
  read-only and not user-specific.
- A DB failure returns a clean `500 { "error": "..." }` rather than a framework
  error page, since the response contract must stay valid JSON for machine callers.
- Reuses `lib/catalog.ts`'s `buildCatalogWhere` (for `inStock`/`condition`) and the
  exported `CATALOG_INCLUDE` relation set, rather than re-deriving them — the
  genre-*name* filter (not in `buildCatalogWhere`, which only filters by `genreId`)
  is layered on top.

## Tests
`app/api/catalog/route.test.ts` — 9 tests: only in-stock products, no auth required,
genre filter, condition filter, invalid condition ignored, default/max/custom limit,
total reflects the full matching count (not just the truncated page), restock flag,
cache header, clean 500 on DB failure.
