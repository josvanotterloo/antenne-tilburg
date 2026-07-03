# Todo

Current work queue. Keep Active short — move items to Backlog if not in-flight.

## Active

### Public catalog & search (`feature/public-catalog-search`)
Full plan: `docs/superpowers/plans/public-catalog-search.md`. Server-side only.
- [ ] Unit 0 — DB: indexes (condition, inStock, createdAt) + tsvector column + GIN
- [ ] Unit 1 — `lib/catalog.ts` (buildCatalogWhere / buildCatalogOrderBy / paging)
- [ ] Unit 2 — `/stock` list (URL filters, chips, sort, grid, pagination, search)
- [ ] Unit 3 — `/stock/[id]` detail (SEO, 404 if missing/out-of-stock)
- [ ] Unit 4 — `/stock/feed.xml` RSS (last 50 arrivals)
- [ ] Unit 5 — admin `/admin/catalog` search + pagination

## Backlog

- [ ] Rename middleware.ts to proxy.ts (Next.js 16 convention)
      See: nextjs.org/docs/messages/middleware-to-proxy

### Admin CRUD (one feature branch per entity — see docs/instructions/generate-route.md)
- [ ] Managed lists: Labels, Genres, Product types — add/rename/delete with a
      guard on delete when products are still linked
- [ ] Products — full CRUD, cover-image upload, mark sold / out of stock,
      list view with search + filter (genre, label, product type, condition)
- [ ] Blog posts — write/edit, publish/unpublish, draft state, cover image
- [ ] Events — CRUD, upcoming/past status
- [ ] Notices — CRUD, active toggle, optional start/end scheduling
- [ ] Opening hours — edit per weekday + adjusted/holiday hours
- [ ] Newsletter subscribers — view + CSV export
- [ ] Want-list requests — read-only admin view
- [ ] Users — manage the two admin accounts / change password
- [ ] Per-page/product/post SEO metadata editor (PageSeo + entity seo fields)

### Public pages pulling real data
- [ ] Stock listing — filterable by the managed lists + "Just In" (createdAt < 30d)
- [ ] Home "Just In" section + upcoming-events + visit teasers from the DB
- [ ] Blog index + `[slug]` post pages
- [ ] Events index + `[slug]` event pages
- [ ] Visit/Contact — live opening hours + map
- [ ] About + FAQ real content
- [ ] Newsletter signup form (name + email) → NewsletterSubscriber
- [ ] Want-list / request form → WantListRequest

### Auth hardening
- [ ] Change seeded placeholder passwords; document real credential handoff
- [ ] Server-side session re-check (getServerSession) on every admin mutation

### SEO
- [ ] Extend sitemap.ts with dynamic product/post/event URLs
- [ ] generateMetadata per entity with PageSeo fallbacks

### Social cross-posting (later phase — see plan §Social cross-posting)
- [ ] Meta Graph API publish hook on post publish (Facebook Page + Instagram)
- [ ] Meta app review for pages_manage_posts / instagram_content_publish
- [ ] Test via Meta sandbox app until approved

### Purchasing (future phase — built for later, not now)
- [ ] orders + order_items tables
- [ ] Mollie checkout (iDEAL first, PayPal later)

### Testing
- [ ] Add a test runner + wire the `run-tests` skill; cover managed-list delete
      guards, auth authorize(), and notice active-window logic first

## Done

- [x] Scaffolded Next.js 14 (App Router, TS) + Tailwind + Prisma + NextAuth
- [x] Prisma schema for all entities (User, Label, Genre, ProductType, Product,
      Post, Event, Notice, OpeningHours, PageSeo, NewsletterSubscriber,
      WantListRequest) + generated client
- [x] NextAuth credentials auth (bcrypt, JWT sessions); `/admin/*` gated by
      middleware; seed with 2 admin users + reference data + opening hours
- [x] Admin shell: login, dashboard, placeholder pages for all 11 sections
- [x] Public shell: shared layout, header/footer (live hours), active-notices
      banner, placeholder pages for all routes
- [x] SEO baseline: robots.ts + sitemap.ts, per-page metadata
- [x] .env.example, updated CLAUDE.md + generate-route.md
- [x] Verified: prisma generate, tsc --noEmit, next build (26/26), next lint
