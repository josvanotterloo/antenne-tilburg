# Full-codebase code review — 2026-07-09/10

Phase 3 of the security work: a whole-codebase review (correctness + reuse/
simplification/efficiency lens), covering pre-existing code untouched this
session — distinct from the OWASP *security* audit
(`owasp-audit-2026-07-09.md`). Four reviewers over slices: `lib/`, `app/api/`,
pages+components, and config/schema/seed/middleware. Findings adjudicated and
verified against the code before fixing.

## Fixed (branch `feature/code-review-fixes`)

| Severity | Finding | Fix |
|---|---|---|
| **High** | Unsubscribe was a GET that hard-DELETEs — email scanners/link prefetchers (SafeLinks, Gmail) silently remove subscribers | GET now renders a confirmation page; deletion moved to POST (`app/api/newsletter/unsubscribe/route.ts`). Live-verified: GET leaves the row, POST deletes. |
| **Medium** | `products` POST — bad/deleted relation id → unhandled P2025 → 500 leaking Prisma internals | try/catch → 400 "Selected label/genre/type no longer exists" |
| **Medium** | `products` PATCH — concurrent delete / bad relation → unhandled P2025 → 500 | try/catch → 404, matching GET/DELETE |
| **Medium** | Newsletter email renderer rewrote `_`/`*` inside built URLs (`utm_source`, `a_b.png`) → broken links/images | Stash built links/images behind private-use sentinels before emphasis passes; label text still emphasised (`lib/email/render.ts`) |
| **Medium** | NewsletterComposer re-enabled Send after success → accidental duplicate blast to whole list | Button disabled + relabelled "Sent" on `status==='sent'` |
| **Medium** | CI ran no typecheck/build; type errors merged green | Added `prisma:generate` + `typecheck` to CI and the pre-commit hook |
| Low | Price used loose `Number()` — `1e309`→Infinity stored as Decimal "Infinity"→500 | Strict decimal-string / finite-number validation, mirroring quantity |
| Low | Confirm route ran expiry check before the already-confirmed check → confirmed user revisiting an old link saw "expired" | Reordered: already-CONFIRMED is always success; expiry only gates a still-PENDING confirm |
| Low | Unsubscribe double-submit → unhandled P2025 | POST treats P2025 as success (idempotent) |
| Low | `proxy.ts` matcher `(?!login)` unprotected any `/admin/login*` route (e.g. `/admin/login-audit`) | `(?!login(?:/|$))` — excludes only `/admin/login` and its subpaths |
| Low | Stock active-filter chips keyed by display label → React key collision when two filters share a label | Keyed by filter type |

## Reviewed and accepted / deferred (not fixed)

- **Systemic (Low):** admin client components (Combobox, PostActions, NoticeActions,
  DeleteButton, form buttons) omit try/catch + error toasts — stuck busy flag on
  network reject, silent no-op on non-ok. Transient-network-only, reload-
  recoverable on an internal 2-admin tool. **Tracked** for a single shared
  `useAsyncAction` helper rather than a 12-file scattershot (tasks/todo.md).
- **Low, deferred to the post-backfill contract migration:** schema
  `quantity @default(0)` vs `inStock @default(true)` mismatch (latent — all
  writers set `inStock` explicitly).
- **Low / by design:** `NEXTAUTH_URL` localhost fallback (prod must set it —
  ops note); `requireAdmin` session-only check (every User is an admin per the
  schema — no role tier exists); future-dated `publishedAt` treated as live (no
  scheduling feature); opening-hours `00:00` close unrepresentable (product edge).

## Verification
- 390 tests green (24 new across the fixes). `tsc`, lint, `next build` clean.
- Live: unsubscribe GET/POST flow against the running app + Postgres; security
  headers via `curl -I` (from the medium-fixes branch).
