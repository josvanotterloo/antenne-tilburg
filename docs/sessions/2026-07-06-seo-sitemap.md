# Session Log — 2026-07-06 (SEO sitemap + metadata)

## What was built
- Dynamic sitemap.xml: static routes + every published post + every in-stock product,
  with graceful DB-down fallback. Home page description added. robots.txt locked with a
  test.

## What worked
- Auditing metadata coverage first showed only the home page lacked metadata (detail
  pages already had generateMetadata) — so the work was small and targeted.
- Live-checking /sitemap.xml confirmed drafts and out-of-stock products are excluded.

## What drifted from intent
- "generateMetadata per entity with PageSeo fallbacks": the per-entity part is done, but
  wiring the PageSeo table as fallbacks for static pages is a separate feature (bundled
  with the admin PageSeo editor) — left in the backlog and noted.

## Signal (what should change in a shared artifact)
- [ ] None

## Updates made
- app/sitemap.ts (+test), app/robots.test.ts, home metadata, feature doc, this log,
  SEO backlog update.
