# Public blog + design foundation

**Status:** branch `feature/public-blog` (commits `0025353`, `b6f3e3e`,
`d86546b`, `f7a9fe6`, `27e7141`) — merged to `master` (2026-07-04).

## Summary
The public-facing design system goes live, and the blog ships on top of it: a
`/blog` index and `/blog/[slug]` post page, published-only, SEO-ready. This is the
first public UI built against `DESIGN.md` ("The Pirate Signal").

## Design foundation (shared by all public pages)
- **`DESIGN.md` / `PRODUCT.md` / `.impeccable/design.json`** (merged earlier):
  pure-black canvas, JetBrains Mono (data voice) + Space Grotesk (headings/prose),
  single indigo signal accent `#6B7DC9` (~5.1:1 on canvas, clears WCAG AA), zero
  radius, flat/hairline depth, monochrome interface with covers as the only colour.
- **`tailwind.config.ts`:** canvas/surface/surface-raised/ink/ink-muted/hairline/
  signal colours; `sans` = Space Grotesk, `mono` = JetBrains Mono (via CSS vars);
  72ch `prose` measure.
- **`app/layout.tsx`:** both fonts via `next/font/google`; the black canvas + bone
  ink + `font-sans` are the document default (public is the primary brand surface).
- **`app/admin/layout.tsx`:** pinned to `text-neutral-900` so the light admin
  surface, which shares the root `<body>`, is unaffected.
- **`app/globals.css`:** brand base (selection colour, signal focus ring,
  `color-scheme: dark`) scoped to `.site-dark`, applied only by the public layout.
- **Chrome restyle:** `SiteHeader` (now a client component — mono nav with an
  active-route signal underline via `usePathname`), `SiteFooter` (mono opening
  hours, tabular-nums), `NoticeBanner` (mono `NOTICE` tag), `Placeholder`.

## Blog
- **`lib/blog.ts`:** `getPublishedPosts()` (status `PUBLISHED`, `publishedAt desc`
  then `createdAt desc`), `getPublishedPostBySlug()` (drafts/unknown → `null`),
  `postDateLabel()` ("04 Jul 2026", UTC-formatted for determinism), `postExcerpt()`
  (whitespace-collapsed, word-boundary truncation with ellipsis).
- **`/blog`:** published posts as a hairline-separated transmission log — mono date,
  Space Grotesk title (signal on hover), muted excerpt; empty state when none.
- **`/blog/[slug]`:** fetch by slug, `notFound()` on draft/missing, renders date +
  title + plain-text body split into paragraphs (rendered as text, no HTML → no
  injection), optional cover. `generateMetadata` prefers `seoTitle`/`seoDescription`,
  falls back to title + excerpt.
- **`prisma/seed.ts`:** 2 published posts + 1 draft (the draft proves drafts never
  surface publicly). Idempotent upsert on the unique slug.

## Confirmed design decisions
- Index is intentionally text-forward (no cover thumbnails) — reads as a catalog/
  transmission log and sidesteps `next/image` remote config. Covers render on detail.
- Body is plain text (admin `<textarea>`), split into paragraphs on blank lines and
  rendered with `whitespace-pre-line` — never as HTML.
- Public visibility = `PUBLISHED` only; the "published" rule lives in `lib/blog.ts`
  so it's unit-tested once and reused.

## Tests & verification
- **17 new unit tests** (203 total, all green): `lib/blog` (date/excerpt/query
  builders), `/blog` render + empty state, `/blog/[slug]` render + 404 +
  `generateMetadata` (SEO fields / fallback / not-found).
- `tsc` clean, `lint` clean (only the pre-existing admin warning).
- **Live against real Postgres:** `/blog` lists the 2 published posts (draft hidden),
  `/blog/fresh-tresor-and-clone` renders, `/blog/draft-in-store` → 404. Verified the
  design matches `DESIGN.md` (black canvas, mono nav w/ signal underline, hairlines).

## Known gaps / not done
- `/blog/[slug]` issues two identical slug queries (`generateMetadata` + page) — low
  impact, consistent with the documented `/stock/[id]` decision; not wrapped in
  `React.cache()` to avoid cross-test memoization.
- Cover images use a plain `<img>` (no `next/image` remote config yet).
- Nav active-match uses `startsWith`; fine for the current route set.
