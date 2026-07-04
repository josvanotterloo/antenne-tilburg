# Plan: Public blog (index + [slug]) + public design foundation

Branch: `feature/public-blog`. Design source of truth: `DESIGN.md` ("The Pirate
Signal" — pure-black canvas, JetBrains Mono data voice + Space Grotesk headings/prose,
single indigo accent `#6B7DC9`, zero radius, flat/hairline depth).

## Scope
Foundation (shared by all public pages) then the two blog pages. TDD for logic/render
behavior; config/styling is the TDD "configuration" exception.

## Steps / commits
1. **Design tokens** — `tailwind.config.ts` (colors, fontFamily, radius 0), `app/globals.css`
   (base: black canvas default, bone ink, focus ring, selection), `app/layout.tsx`
   (next/font: Space Grotesk + JetBrains Mono as CSS vars; body = canvas/ink/font-sans).
   Admin layout gets explicit `text-neutral-900` so the light admin surface is unaffected.
2. **Base chrome** — restyle `SiteHeader`, `SiteFooter`, `NoticeBanner` to DESIGN.md
   (mono uppercase nav w/ signal active underline; hairline dividers; black surfaces).
3. **Blog query layer** — `lib/blog.ts` + `lib/blog.test.ts` (TDD):
   `getPublishedPosts()` (status PUBLISHED, order publishedAt desc then createdAt),
   `getPublishedPostBySlug(slug)` (published only, else null). `postDateLabel()` helper.
4. **Blog index** — `app/(public)/blog/page.tsx` + test (TDD): lists published posts
   (title, mono date, excerpt, cover), links to `/blog/[slug]`; empty state; drafts hidden.
5. **Blog [slug]** — `app/(public)/blog/[slug]/page.tsx` + test (TDD): fetch by slug,
   `notFound()` when missing/draft, render title/date/cover/body (plain-text → paragraphs),
   `generateMetadata` (seoTitle/seoDescription fallbacks).
6. **Seed** — add a couple of PUBLISHED sample posts to `prisma/seed.ts` for the visual check.

## Close-out (branching.md)
`/code-review` (fix MEDIUM+), visual check (empty/filled, mobile/desktop), FF-merge to
master + delete branch, push, feature doc `docs/features/NNN-public-blog.md`, session log,
update CLAUDE.md test-count baseline if referenced, run tests+lint.

## Notes
- Post.body is plain text (admin textarea) — render as paragraphs, no HTML injection.
- Data pattern mirrors `lib/catalog.ts` + `app/(public)/stock/*`.
- Model: Post{ id, title, slug, body, coverImage?, status, publishedAt?, seoTitle?,
  seoDescription?, createdAt, updatedAt }.
