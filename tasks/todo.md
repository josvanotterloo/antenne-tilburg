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

### Stock management
- [x] Suppliers, supply orders (create/edit/receive, re-receiving a PARTIAL
      order), and a `StockTransaction` ledger replacing the old hand-edited
      `Product.quantity` — `docs/features/stock-management.md` (supersedes
      `docs/features/stock-quantity.md`)
- [x] Dymo label printing (2026-08-06) — `GET /api/admin/label/[productId]`
      generates DYMO Connect XML for a 89×36mm label (part 99012); Print
      label button on the edit page and a print icon on the catalog list,
      both gated on a required-fields guard. `DYMO_MODE=preview` (default)
      serves the XML for manual verification; `print` POSTs it to the local
      Dymo Connect service. Physical-printer verification (paper `<Id>`,
      row 3/4 text fitting, print-success response shape) still pending —
      `docs/features/dymo-label-printing.md`
- [x] Reference page typeahead (2026-08-06) — `/admin/catalog/reference`
      (labels/genres/product-types/artists) upgraded from an unbounded flat
      list to server-side search, reusing the existing `?q=` typeahead
      endpoints. Fixes the actual scale bug (the page's own SSR fetch
      loaded every row, no limit) at production scale (55k+ artists,
      10k+ labels). Deferred: `Combobox`'s `_count` join now runs on every
      typeahead caller including the product-form combobox (bounded cost,
      not a shared hook with `ReferenceSection`'s debounce by deliberate
      design) — `docs/features/reference-page-typeahead.md`
- [x] Order & transaction system redesign (2026-08-07) — product-driven
      quick-add ordering (one-click "Order" button on catalog/transactions
      rows), a grouped orders overview (`/admin/catalog/orders`, by
      supplier/date/flat) with inline quantity edit and per-line receive,
      mark-all-as-sent, and a new monthly transactions ledger
      (`/admin/catalog/transactions`); replaces the old manual order
      create/edit/detail pages entirely. `Product.supplierId` /
      `Label.supplierId` added to link products to suppliers —
      `docs/features/order-transaction-redesign.md`

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
- [x] New Arrivals overhaul (2026-08-05) — renamed "Stock" → "New Arrivals" in
      nav/copy; `/stock` simplified to the last 100 in-stock arrivals, no
      filters/search/sort/pagination/grid; removed price and clickable
      artist/label links from every public surface (incl. JSON-LD, RSS,
      `/api/catalog`); deleted the This Week/Last Week/Back In Stock sections
      — `docs/features/new-arrivals-overhaul.md`
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

### Orders
- [ ] Export PDF per supplier group on the orders overview page
      (`/admin/catalog/orders`) — button already present, currently disabled.
- [ ] **Legacy multi-open-order-per-supplier data check.** `lib/order-overview.ts`'s
      supplier grouping assumes at most one non-RECEIVED `SupplyOrder` per supplier
      (an invariant quick-add enforces going forward, but the old manual order-creation
      form — removed in this redesign — had no such constraint). If a supplier ever
      ends up with two open orders in real data, the grouped overview would silently
      show lines from both under one header, keyed off only one order's id/status —
      "Mark all as sent" would then only affect one of the two. Not relevant until/unless
      a legacy-data migration or audit surfaces this; run
      `SELECT "supplierId", count(*) FROM "SupplyOrder" WHERE status <> 'RECEIVED' GROUP BY 1 HAVING count(*) > 1;`
      against production before relying on the grouped view for a supplier with prior
      manually-created orders, and consolidate or re-key the grouping by order id if any
      are found.

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
- [ ] Re-check the `brace-expansion`/`minimatch` advisory (9 `high` npm
      audit findings, assessed dev-only/non-exploitable, not fixed) after
      any future `eslint`, `@eslint/*`, or `eslint-config-next` bump —
      `docs/features/security-dependency-updates.md`

### Code quality
- [x] Full-codebase code review (Phase 3, 2026-07-09/10) — 1 High + 5 Medium
      fixed; report `docs/security/code-review-2026-07-09.md`
- [x] Shared `apiSend` + `useAsyncAction` for admin fetch error handling — all
      admin mutations now fail visibly; `docs/features/admin-fetch-error-handling.md`

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
Done — Vitest runner + `run-tests` skill in place; 892 tests (as of
hardening public input fields, 2026-08-14; +3 for `lib/newsletter-input.ts`'s
email length cap and control-character stripping). 889 tests as of the
newsletter retry queue, 2026-08-13; +14 net for `confirmEmailSentAt` +
the unified graceful-degradation signup contract, the new
`POST /api/admin/newsletter/retry-pending` route, `RetryPendingButton`,
the subscriber-list badge states, and two `/code-review` regression tests
— the retry-eligibility age cutoff and the send-succeeded-but-DB-write-failed
counting fix). 875 tests as of adding Sentry error
monitoring, 2026-08-12; +4 of those for `lib/sentry-scrub.ts`'s
email-redaction helper, incl. its fail-safe-on-serialization-failure path —
no tests for the Sentry init/config files themselves, per that task's scope.
Covers managed-list delete
guards, `authorize()`, notice active-window logic, fuzzy search, uploads,
markdown rendering, sitemap, the public catalog API, Schema.org structured
data, Dymo label XML generation, reference-data typeahead search,
product-driven quick-add ordering, the grouped orders overview, the monthly
transactions ledger, the shared `withTimeout` helper, and the public/admin
flows. (842 as of the order & transaction system redesign, 2026-08-07 —
+29 for external-call timeouts: `lib/with-timeout.ts`, the Resend/DYMO
timeout tests, and the newsletter route's timeout-vs-real-failure test.
789 as of the reference page typeahead, 2026-08-06; 739 as of the New
Arrivals overhaul, 2026-08-05, down from 781 — expected, see that entry's
history; +30 for Dymo label printing, +20 for the reference page typeahead,
+53 net for the order & transaction redesign, which also deleted the old
manual-order route/component tests per its Test Contract.)

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
