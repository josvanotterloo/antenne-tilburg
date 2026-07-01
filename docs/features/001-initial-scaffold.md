# 001 — Initial project scaffold

**Status:** Merged to `master` (2026-07-01) · commits `7b3f503`, `32caed3`

## Summary
Bootstrapped the Antenne Tilburg website from the kickoff spec: a Next.js 14
(App Router, TypeScript) application with Prisma + PostgreSQL, NextAuth
credentials auth, Tailwind CSS, and placeholder admin + public shells. This is
the foundation every later feature builds on; no business logic (CRUD, real
data) is implemented yet.

## What's in place
- **Toolchain:** Next.js 14, React 18, TypeScript, Tailwind 3, Prisma 5,
  NextAuth v4, bcryptjs.
- **Schema** (`prisma/schema.prisma`): User, Label, Genre, ProductType, Product
  (Decimal price, Genre M2M, condition/inStock), Post, Event, Notice,
  OpeningHours (one row per weekday, `dayOfWeek` unique), PageSeo,
  NewsletterSubscriber, WantListRequest + Condition/PostStatus/EventStatus enums.
- **Auth:** credentials provider (bcrypt, JWT sessions), `/admin/*` protected by
  `middleware.ts` (login excluded) redirecting to `/admin/login`. `prisma/seed.ts`
  seeds two equal admin accounts + starter labels/genres/product-types/hours.
- **Admin shell:** login, dashboard, and placeholder pages for all 11 sections
  with a sidebar nav (`AdminNav`, hides itself on the login route).
- **Public shell:** shared layout (`SiteHeader`, `SiteFooter` with live opening
  hours, `NoticeBanner` showing active notices), plus every public route
  including `blog/[slug]` and `events/[slug]`.
- **SEO baseline:** `app/robots.ts` + `app/sitemap.ts`, per-page `metadata`.
- **Docs/config:** `CLAUDE.md` setup, `.env.example`, updated
  `docs/instructions/generate-route.md` for App Router/Prisma conventions,
  `tasks/todo.md` roadmap.

## Design decisions
- **Versions:** Next 14 / React 18 / NextAuth v4 / Tailwind 3 — the most
  battle-tested combination satisfying "Next.js 14+". bcryptjs (pure JS) avoids
  native builds.
- **JWT sessions, no Prisma adapter** — simplest setup for two credential-based
  admins.
- **Graceful DB degradation:** `NoticeBanner` and `SiteFooter` catch DB read
  failures (log + return empty) so the site builds/renders without a live
  database. This is why `next build` passes in CI without Postgres.

## Code-review fixes (`32caed3`)
- `middleware.ts` used the bare `next-auth/middleware` re-export, which redirects
  to the default `/api/auth/signin`; switched to `withAuth({ pages: { signIn:
  "/admin/login" } })`.
- `NoticeBanner`/`SiteFooter` now log before degrading instead of swallowing
  errors silently.

## Verification
`prisma generate` ✓ · `tsc --noEmit` ✓ · `next build` ✓ (26/26 pages) ·
`next lint` ✓ (0 warnings).

## Known gaps / not done
- **No live Postgres in the build sandbox**, so `prisma migrate` and `db:seed`
  were **not** run against a real database, and no DB-dependent tests exist yet.
- No automated test suite wired (`run-tests` skill has nothing to run yet).
- Visual consistency check deferred — all pages are placeholders.
- Placeholder admin passwords (`changeme123`) must be rotated before deploy;
  `NEXTAUTH_SECRET` must be generated.

## Next
See `tasks/todo.md` — first slice is the managed-list CRUD (Labels/Genres/
Product types) with delete guards.
