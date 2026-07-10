# Todo

Current work queue. Keep Active short — move items to Backlog if not in-flight.

## Active

### Admin CRUD slices (each: TDD, own branch, full close-out)
IA: Content = {posts, newsletter}; Settings = {hours, notices, subscribers, users}.
- [x] Blog posts — `docs/features/admin-blog-posts.md`
- [x] ~~Events~~ — **removed entirely** (2026-07-08); notices cover one-off
      announcements. `docs/features/remove-events.md`
- [x] Notices — `docs/features/admin-notices.md`
- [x] Opening hours — base weekly grid; `docs/features/admin-opening-hours.md`
      (holiday/adjusted overrides deferred)
- [x] Newsletter subscribers — `docs/features/admin-subscribers.md`
- [x] Users — `docs/features/admin-users.md`
- ~~Want-list requests~~ — **dropped** (removed from plan)

**Admin CRUD sequence complete** (blog posts, notices, opening hours,
subscribers, users). Remaining admin sections: none — all managed entities have
real admin UIs.

## Backlog

### Admin CRUD
Complete — see the Active section above (managed lists, products, blog posts,
notices, opening hours, subscribers, users all have real admin UIs). Remaining nuance:
adjusted/holiday opening-hours overrides are deferred (noted in Active).

### Public pages pulling real data
- [x] Design foundation — `DESIGN.md`/`PRODUCT.md`, tokens, fonts, chrome restyle
      ("The Pirate Signal") — `docs/features/public-blog.md`
- [x] Stock listing — filterable by the managed lists + "Just In" (createdAt < 30d)
      — `docs/features/public-catalog-search.md`
- [x] Home "Just In" (100 latest) + blog teaser + visit teaser — `docs/features/public-home.md`
- [x] Blog index + `[slug]` post pages — `docs/features/public-blog.md`
- [x] ~~Events~~ — dropped from public (2026-07-04, `docs/features/public-surface-trim.md`),
      then removed entirely (2026-07-08, `docs/features/remove-events.md`).
- [x] Visit/Contact — live opening hours + map — `docs/features/public-visit.md`
- [x] About + FAQ real content — `docs/features/public-about.md`, `docs/features/public-faq.md`
- [x] Newsletter signup form (name + email) → NewsletterSubscriber — `docs/features/public-newsletter.md`
- [x] Newsletter sending — double opt-in, admin composer, Resend send to confirmed
      subscribers, one-click unsubscribe — `docs/features/newsletter-sending.md`
- [x] ~~Want-list / request form~~ — dropped: removed the orphaned admin want-list page;
      no public form. `WantListRequest` model kept in the schema (harmless).
      `docs/features/remove-want-list.md`
- [x] `SocialLinks` lives in the site footer (every page). Added to the home page then
      removed as redundant with the footer — `docs/features/footer-redesign.md`

### Platform / tech debt
- [ ] **Pre-scale task** — Move blog/post uploads from `public/uploads` to Hetzner Object
      Storage (only the `/api/admin/uploads` handler changes; the returned URL is the
      contract). Fine on a single instance for now; needed before scaling out / a real
      deploy. Add image deletion/GC (orphaned uploads currently accumulate).
      See `docs/features/blog-photos.md`.
- [x] **Upgraded React 18.3.1 → 19.** No client-component changes were needed;
      `tsc` + full test suite + `next build` all green. Deduped the `/blog/[slug]` and
      `/stock/[id]` double queries with `React.cache()`. `docs/features/react-19-upgrade.md`
- [x] **Migrated next-auth v4 → v5 (Auth.js)** — clears the `react ^18` peer warning;
      split Edge-safe config for the middleware. `docs/features/next-auth-v5.md`

### Security
- [x] OWASP Top 10 full-source audit (2026-07-09) —
      `docs/security/owasp-audit-2026-07-09.md`
- [x] Subscriber emails encrypted at rest (AES-256-GCM + keyed hash) —
      `docs/features/email-encryption-at-rest.md`. **Deploy note:** set
      `EMAIL_ENCRYPTION_KEY`, then run
      `npx tsx --env-file=.env scripts/encrypt-subscriber-emails.ts` once.
- [x] Medium findings fixed: security headers, login rate limiting,
      XFF-spoofable signup limiter — `docs/features/owasp-medium-fixes.md`
- [ ] Contract migration after prod backfill: verify zero `emailHash IS NULL`
      rows, then `ALTER COLUMN "emailHash" SET NOT NULL` (closes the
      transitional nullable state for good)

### Code quality
- [x] Full-codebase code review (Phase 3, 2026-07-09/10) — 1 High + 5 Medium
      fixed; report `docs/security/code-review-2026-07-09.md`
- [ ] Shared `useAsyncAction` helper for admin fetch error handling (systemic
      Low from the review — stuck busy flags / silent no-ops)

### Auth hardening
- [ ] Change seeded placeholder passwords (`changeme123` in `prisma/seed.ts`);
      document real credential handoff — **required before any deploy**
- [x] Server-side session re-check (getServerSession) on every admin mutation —
      already implemented: `requireAdmin` guards all `/api/admin/*` handlers (incl.
      managed lists via the `reference-crud` factory), `withAuth` middleware gates
      admin pages; unit-tested (`lib/api-auth.test.ts`)

### SEO
- [x] Dynamic sitemap.xml (static + published posts + in-stock products); robots.txt
      verified — `docs/features/seo-sitemap.md`
- [x] Per-entity generateMetadata on all public pages (posts use seoTitle/seoDescription;
      products use description; home + static pages have metadata) —
      `docs/features/seo-sitemap.md`. PageSeo-table overrides still pending (below).
- [ ] Admin editor for per-page/product/post SEO metadata (PageSeo + entity seo fields),
      and wire PageSeo fallbacks into the static pages' metadata

### Social cross-posting (later phase — see plan §Social cross-posting)
- [ ] Meta Graph API publish hook on post publish (Facebook Page + Instagram)
- [ ] Meta app review for pages_manage_posts / instagram_content_publish
- [ ] Test via Meta sandbox app until approved

### Purchasing (future phase — built for later, not now)
- [ ] orders + order_items tables
- [ ] Mollie checkout (iDEAL first, PayPal later)

### Testing
Done — Vitest runner + `run-tests` skill in place; 390 tests cover managed-list
delete guards, `authorize()`, notice active-window logic, fuzzy search, uploads,
markdown rendering, sitemap, and the public/admin flows.

## Done

- [x] Scaffolded Next.js 14 (App Router, TS) + Tailwind + Prisma + NextAuth
- [x] Prisma schema for all entities (User, Label, Genre, ProductType, Product,
      Post, Notice, OpeningHours, PageSeo, NewsletterSubscriber,
      WantListRequest) + generated client
- [x] NextAuth credentials auth (bcrypt, JWT sessions); `/admin/*` gated by
      middleware; seed with 2 admin users + reference data + opening hours
- [x] Admin shell: login, dashboard, placeholder pages for all 11 sections
- [x] Public shell: shared layout, header/footer (live hours), active-notices
      banner, placeholder pages for all routes
- [x] SEO baseline: robots.ts + sitemap.ts, per-page metadata
- [x] .env.example, updated CLAUDE.md + generate-route.md
- [x] Verified: prisma generate, tsc --noEmit, next build (26/26), next lint
