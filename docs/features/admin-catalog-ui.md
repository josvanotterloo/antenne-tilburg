# Admin Catalog UI

**Status:** Merged to `master` (2026-07-03) · branch `feature/admin-catalog-ui`
(commits `08aa021`, `5105098`, `306d3de`, `a55de5b`, `0c52a30`, `8c36753`)

## Summary
Introduces the admin information architecture (a dark top nav with Catalog /
Content / Settings) and builds the **Catalog** section end-to-end: managed
reference-data CRUD, the product list, and a full product add/edit form with a
reusable quick-add combobox. Built strict-TDD (test → RED → implement → GREEN).

## What's in place
- **Top nav + IA** (`components/layout/AdminTopNav.tsx`): dark `#1a1a1a` bar,
  wordmark → `/admin/catalog`, three sections, sign-out, active-state via
  `usePathname`, login-page guard. `/admin` redirects to `/admin/catalog`. The
  old sidebar `AdminNav` and the superseded flat routes (products, labels,
  genres, product-types) were removed; `/admin/content/posts` and
  `/admin/settings/hours` are placeholders.
- **Reference data** (`/admin/catalog/reference`): Labels, Genres, Product
  Types — inline add/edit/delete with an in-use guard ("In use by N products").
- **Product list** (`/admin/catalog`): table (artist, title, catalog no.,
  label, genre, type, condition badge, €price, in-stock, edit/delete) with a
  non-blocking two-click delete confirm.
- **Product form** (`/admin/catalog/new`, `/admin/catalog/[id]/edit`): all
  fields + condition/in-stock toggles + three quick-add comboboxes.
- **Combobox** (`components/ui/Combobox.tsx`): single-select, type-to-filter,
  quick-add via POST, keyboard navigable (arrows/Enter/Escape), ARIA roles.

## API surface (all auth-gated via `lib/api-auth.requireAdmin`)
- `GET/POST /api/admin/{labels,genres,product-types}` and `PATCH/DELETE /[id]`
  — from the shared `lib/reference-crud` factory (validation + server-enforced
  delete guard 409 + duplicate-name 409).
- `GET/POST /api/admin/products`, `GET/PATCH/DELETE /api/admin/products/[id]`
  — validation via `lib/product-input`; missing-record DELETE returns 404.

## Design decisions
- **API auth is per-handler**, not middleware: `requireAdmin()` returns a 401
  JSON response, because `middleware.ts` guards admin *pages* (HTML redirect),
  which is wrong for `fetch`.
- **Delete guard + duplicate-name are enforced server-side** (409), never
  trusting the UI to hide a button.
- **Reference resources share one factory** rather than triplicating CRUD; the
  Prisma delegate is passed via a minimal `ReferenceDelegate` interface
  (`as unknown as` at the six route files — Prisma's generated delegate types
  don't structurally match, but the factory itself is fully type-checked).
- **`prisma.config.ts`** replaces `package.json#prisma`; it calls
  `process.loadEnvFile()` because Prisma stops auto-loading `.env` when a
  config file is present.

## Tests & verification
- **55 unit tests** (Vitest): auth gate, reference-crud CRUD + guards +
  duplicate-name, per-route wiring, product routes, product-input validation,
  AdminTopNav render, Combobox filter/quick-add/keyboard.
- `tsc --noEmit` clean · `eslint .` clean · `next build` compiles.
- **Live behavioral verification** (authenticated HTTP against a running dev
  server + real Postgres): login → redirect, nav sections, reference add
  (incl. duplicate → 409), delete guard (409 "In use by 1 products"),
  happy-path delete (200), product list (3 seeded products with relations).

## Known gaps / not done
- **No visual DOM click-through** — the Chrome extension was not paired to the
  Claude Code account, so verification was done at the HTTP layer. Layout /
  colors / active-nav appearance were not visually confirmed.
- "Warp Records" is already seed data, so adding it returns 409 (expected).
- Content and Settings sections are placeholders (future sessions).
- Combobox has no outside-click-to-close; selected value's text clears while
  the input is focused (typical search-combobox behaviour).
