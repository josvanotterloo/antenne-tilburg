# SEO: dynamic sitemap + metadata + robots

**Status:** branch `feature/seo-sitemap` — merged to `master` (2026-07-06).

## Summary
`sitemap.xml` now covers all public routes including live posts and stock; every public
page has metadata; `robots.txt` verified and locked with a test.

## What changed
- **`app/sitemap.ts` → dynamic (`force-dynamic`):** the static public routes plus a URL
  for every **published** post (`/blog/[slug]`) and every **in-stock** product
  (`/stock/[id]`), with the entity's `updatedAt` as `lastModified`. Drafts and
  out-of-stock products are excluded (`getPublishedPosts` / `where: { inStock: true }`).
  Degrades to the static routes if the DB is unavailable rather than serving a 500.
- **Home metadata:** the home page had no `metadata` (only the layout default) — added a
  description. Every public page now emits metadata:
  - static pages (`/`, `/stock`, `/blog`, `/visit`, `/about`, `/faq`, `/newsletter`) —
    `export const metadata`;
  - `/blog/[slug]` — `generateMetadata` (prefers `seoTitle`/`seoDescription`, falls back
    to title + excerpt);
  - `/stock/[id]` — `generateMetadata` (product description / composed fallback).
- **`robots.txt`:** already correct (`Allow: /`, `Disallow: /admin`, sitemap pointer);
  added a test to lock it.

## Tests & verification
- 6 new tests (284 total green): sitemap includes static routes + a URL per published
  post + per in-stock product, queries only in-stock, never lists `/admin`, and degrades
  to static on DB error; robots allows `/`, blocks `/admin`, points at the sitemap.
- **Live:** `/robots.txt` renders correctly; `/sitemap.xml` lists the 7 static routes, 3
  published posts (the draft excluded), and 5 in-stock products; the home `<meta
  name="description">` and a product detail's `generateMetadata` description both render.

## Still pending (separate backlog item)
- `PageSeo`-table overrides for the static pages, and an admin editor to author them —
  tracked under "Admin editor for per-page SEO metadata".
