# OWASP Medium fixes (audit follow-up)

**Status:** branch `feature/owasp-medium-fixes` — merged to `master` (2026-07-09).

Closes the three Medium findings from `docs/security/owasp-audit-2026-07-09.md`
(#1 headers, #2 login rate limiting, #4 spoofable XFF). All TDD.

## Fixes
1. **Security headers** (`next.config.mjs`) — `headers()` sets on every route:
   CSP (`default-src 'self'`, `frame-ancestors 'none'`, `base-uri`/`form-action
   'self'`, `img-src https:` for admin-entered cover URLs, `frame-src` for the
   `/visit` OpenStreetMap embed, `script/style 'unsafe-inline'` for Next's inline
   bootstrap + `'unsafe-eval'` in dev only for react-refresh), `X-Content-Type-
   Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy:
   strict-origin-when-cross-origin`, `Strict-Transport-Security` (1yr). Verified
   live with `curl -I` on `/` and `/admin/login`.
2. **Login rate limiting** (`lib/authorize.ts`) — per-email (5) and per-IP (20)
   sliding windows over 15 min, reusing `createRateLimiter`. Over-limit attempts
   fail closed with the same `null` as bad credentials (no enumeration) *before*
   any DB/bcrypt work. `authorize` now receives the request and passes
   `clientIp(request.headers)`.
3. **Spoof-resistant client IP** (`lib/client-ip.ts`) — shared `clientIp()` uses
   the **rightmost** `x-forwarded-for` entry (the hop the trusted proxy
   appended); leftmost entries are client-controlled. Adopted by both the login
   limiter and the newsletter signup limiter (which previously read the
   spoofable leftmost value — the actual bypass in finding #4).

## Tests & verification
- 375 tests green (11 new: rightmost-XFF parsing incl. spoof prefix, login
  email/IP lockout + isolation + success-unaffected, header presence + CSP
  contents, newsletter spoof-bypass). `tsc`, lint, `next build` clean.
- Live: prod server `curl -I` confirmed all headers on public + admin routes.

## Accepted tradeoffs
- **Account-lockout DoS:** per-email limiting lets someone who knows an admin
  address keep it throttled (inherent to per-account limits). Low impact here —
  login is unlinked, admin emails unpublished, state is in-process (resets on
  redeploy), and only 2 accounts exist. Revisit with a shared store + progressive
  backoff if the admin surface grows.
- Limiter state is per-process (same as the newsletter limiter); move to Redis
  if scaled past one instance.

## Remaining audit items (Low/Info, not in this branch)
30-day JWT sessions, unsubscribe-on-GET prefetch, `NEXTAUTH_URL` localhost
fallback, `npm ci` in CI, admin audit trail — tracked in the audit report.
