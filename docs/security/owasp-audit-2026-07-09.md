# OWASP Top 10 (2021) Audit — 2026-07-09

Full-source audit: every API route, lib, page, component, config, schema, seed,
CI workflow and git hook. Stack at audit time: Next 16.2.10 / React 19 /
next-auth 5.0.0-beta.31 / Prisma 6.19.3 / PostgreSQL.

All `/api/admin/*` handlers verified guarded by `requireAdmin` (programmatic
check, none unguarded). Admin pages gated by the `proxy.ts` matcher.

## Findings

| # | Finding | OWASP | Severity | Status |
|---|---------|-------|----------|--------|
| 1 | No security headers (CSP, frame-ancestors, nosniff, HSTS, Referrer-Policy) | A05 | **Medium** | Open → `feature/owasp-medium-fixes` |
| 2 | No rate limiting / lockout on admin login (`/api/auth/callback/credentials`) | A07 | **Medium** | Open → `feature/owasp-medium-fixes` |
| 3 | Subscriber PII (email) stored in plaintext | A02 | **Medium** | **Fixed** — `docs/features/email-encryption-at-rest.md` |
| 4 | Newsletter signup rate limiter keys on the *leftmost* `x-forwarded-for` entry (client-spoofable → bypass → unbounded confirmation-email sends) | A04 | **Medium** | Open → `feature/owasp-medium-fixes` |
| 5 | 30-day admin JWT sessions; no invalidation on password change | A05/A07 | Low | Open |
| 6 | One-click unsubscribe deletes on GET — mail-scanner prefetch can unsubscribe users; no `List-Unsubscribe` header | A04 | Low | Open |
| 7 | `NEXTAUTH_URL ?? "http://localhost:3000"` fallback in 5 prod paths (emails/sitemap/RSS emit localhost links if env unset) | A05 | Low | Open |
| 8 | `npm audit`: 2 moderate (postcss <8.5.10 bundled inside next; build-time only). next-auth is a pinned beta | A06 | Low | Watch — bump next when patched; move next-auth to GA on release |
| 9 | Subscriber emails were logged on send failure; no admin audit trail | A09 | Low | Log-PII part **fixed** with #3 (id-only logging); audit trail open |
| 10 | CI uses `npm install` instead of `npm ci` | A08 | Low | Open |
| 11 | `confirmToken` stored plaintext (DB dump → mass unsubscribe possible) | A02 | Info | Accepted |
| 12 | Email renderer permits `javascript:` hrefs in admin-authored markdown (email clients block; attribute breakout already escaped) | A03 | Info | Accepted |
| 13 | CSRF defense on admin mutations rests implicitly on Auth.js `SameSite=Lax` cookie | A01 | Info | Accepted — documented here |

## Clean categories
- **A03 Injection:** both `$queryRaw` sites use `Prisma.sql` placeholders; LIKE
  wildcards escaped; React/react-markdown escaping intact (default
  `urlTransform` blocks `javascript:`); uploads sniff magic bytes and write
  `randomUUID().ext` only; CSV formula injection neutralized; XML escaped.
- **A10 SSRF:** no server-side fetch of user-supplied URLs anywhere.

## Prior art
Builds on `docs/features/security-hardening.md` (2026-07-08): signup rate
limit, constant-time login, atomic sell-one, upload sniffing, strict quantity
validation — all confirmed still in place.
