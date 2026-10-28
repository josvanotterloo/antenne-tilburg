# Observability logging groundwork

**Status:** branch `feature/observability-logging` (2026-10-28).

## Summary
Lightweight, PII-safe, structured logging plus a request correlation id —
proportional to a low-traffic shop, not a telemetry pipeline or session
replay. Lets a human reconstruct one request's path through stdout for
triage. Sentry stays the error tool; nothing here competes with it.

Out of scope, parked post-launch: an autonomous analysis loop, full session
replay, a user-telemetry pipeline.

## Design

### Request correlation id
`proxy.ts` (Next.js 16's renamed `middleware.ts`) attaches `x-request-id` to
every request it matches (`/admin` pages and `/api/:path*`) — generated if
the caller didn't send one, echoed back on both the forwarded request and
the response headers. It runs on the Edge runtime, so it cannot reach into a
Node-side `lib/` call directly.

Each instrumented route handler wraps its body in `withRequestContext(req,
handler)` (`lib/log/context.ts`), which reads the header and opens a
`node:async_hooks` `AsyncLocalStorage` scope around the handler. Any `lib/`
function inside that scope calls `getRequestId()` instead of needing the id
threaded through every call signature — outside any scope (an unwrapped
route, or a unit test calling a `lib/` function directly) it falls back to
the string `"unknown"` rather than throwing.

To find a request's id: read the `x-request-id` response header, or a
request's own header if the caller supplied one. To reconstruct its path:
`docker logs <container> | grep '"requestId":"<id>"'` (or the journald
equivalent — see "Log destination" below).

### Event taxonomy
`lib/log/events.ts` defines `LogEvent` as a closed TypeScript union — a call
site cannot invent an ad hoc event name or field:

- `request.served` — reserved for a future general request-logging pass;
  not yet emitted anywhere (see "What's deliberately not done yet").
- `catalog.search` — `outcome`, `resultCount?`, `durationMs`.
- `auth.login` — `outcome`, `reason?` (`bad_credentials` | `rate_limited`),
  `userId?` (only on success).
- `admin.mutation` — `outcome`, `entity` (`stock` | `customer_order` |
  `reference_entity`), `action`, `entityId?`, `actorUserId` (**required**).
- `email.send` — `outcome`, `kind`, `durationMs?`.
- `error` — `where`, `errorKind` (never `error.message` — message text can
  embed user input).

Every variant carries `requestId`. The union's field list is itself the
PII guardrail: no variant anywhere has a slot for a raw search term, email,
name, address, or request body — a future call site can't pass one through
without first changing the type, which `tsc --noEmit` (run in CI) catches.

`SYSTEM_ACTOR_ID = "system"` is the sentinel for an `admin.mutation` with no
human actor (a seed or migration script). `actorUserId` is never optional —
a caller with no session user must pass this explicitly, so "who did this"
can never be silently absent from the log.

### Writing an event
`logEvent()` (`lib/log/log.ts`) is pure and synchronous: one
`JSON.stringify(event)` line to `console.log`, or `console.error` when
`outcome === "failed"` or the event is `error` — matching the existing
failure-logging convention. No file I/O, no new dependency.

### Redaction helper
`lib/log/redact.ts`, for the one case the taxonomy doesn't close off by
shape alone — a field that's logged verbatim but might incidentally contain
PII:
- `redactFreeText(value)` → `{ length }` — never logs content, only length.
  Not currently called by any touched call site (no instrumented route logs
  a raw search term — `catalog.search`'s only free-text-adjacent input,
  `/api/catalog`'s `genre` filter, isn't logged at all); kept as forward
  groundwork for the next route that needs it, same as `SYSTEM_ACTOR_ID`.
- `redactKnownPatterns(value)` — strips an email- or phone-shaped substring
  from a string before it's logged, reusing the detection-pattern idea (not
  the code) from `lib/sentry-scrub.ts`.

## What is and isn't logged
**Never:** emails, names, addresses, phone numbers, payment data, raw
request bodies, raw search/free-text input, session tokens, JWTs,
passwords, full stack traces or `error.message` (Sentry already owns full
exception detail via `captureRequestError`/`captureException`).

**Logged:** internal ids (`userId`, `actorUserId`, `entityId`,
`requestId`), event outcome, a closed set of enum-like fields (`entity`,
`action`, `reason`, `kind`), counts and durations.

## Touched call sites
- `proxy.ts` / `lib/auth.config.ts` — request-id attachment; see "Critical
  auth finding" below for why this required extending the *existing*
  proxy.ts rather than adding a new middleware file.
- `lib/authorize.ts` — `auth.login` on every return path (success, bad
  credentials, rate-limited), plus a structured `error` event alongside the
  existing `console.error` on a DB/bcrypt failure.
- `app/api/catalog/route.ts` — `catalog.search`.
- `lib/stock.ts` (`applyStockTransaction`, now requires `actorUserId`) —
  `admin.mutation` (`entity: "stock"`). Call sites: the 5 real callers
  (plus-one, sell-one, adjust, products POST, supply-order line receive).
- `lib/reference-crud.ts` (`collectionHandlers`/`itemHandlers`, POST/PATCH/
  DELETE now require `actorUserId`) — `admin.mutation`
  (`entity: "reference_entity"`). Covers genres, product-types, and
  artists' POST; labels and artists' PATCH/DELETE have their own bespoke
  `requireAdmin()`-based routes outside this factory and are untouched.
- `lib/customer-orders.ts` (`writeCustomerOrders`, now requires
  `actorUserId`) — `admin.mutation` (`entity: "customer_order"`, no
  `entityId`: this is a single free-form notes file, not a row-per-order
  model — the plan's original `customer_order.intake` taxonomy slot assumed
  a multi-step flow that doesn't exist here and was dropped).
- `lib/email/send.ts` (`sendEmail`, now requires `kind`) — `email.send`.
- `app/api/newsletter/route.ts` — the confirmation-email failure here is
  caught and the route still returns 201, so Sentry's `onRequestError`
  (unhandled errors only) never sees it. Added a structured `error` event
  alongside the existing `console.error`. The response behavior itself
  (still 201, recovered via the admin retry queue) is unchanged — that's
  separate, unrelated scope.

A new `requireAdminUserId()` (`lib/api-auth.ts`) sits alongside the existing
`requireAdmin()` for the handful of routes above that need the session
user's id — adding it avoided an interface change to `requireAdmin()` that
would have rippled through the 30+ routes that don't need an actor id.

Deliberately **not** touched: every other existing `console.error` site
(`lib/opening-hours.ts`, the admin newsletter send/retry-pending routes' own
per-subscriber-loop logging, etc.). Migrating every call site isn't what
"groundwork" means — a later pass can widen coverage once this pattern is
proven.

## Critical auth finding (why this touched proxy.ts, not a new file)
The investigation that led to this plan found "no existing middleware-based
auth" and planned a brand-new `middleware.ts` as a pure pass-through. That
premise was wrong: Next.js 16 renamed `middleware.ts` to `proxy.ts`, and
`proxy.ts` already existed at the repo root, gating `/admin` *pages* (not
API routes) via NextAuth's `authorized` callback. Since only one
middleware/proxy entry point is allowed, the existing file had to be
extended, not shadowed — and its matcher had to grow to cover `/api/:path*`
for every route to get a request id, which would also have made the
`authorized` callback (originally a blanket `!!auth?.user`) start requiring
login on every API route, including public ones (catalog, newsletter
signup) — a severe regression.

Fix: `isProtectedAdminPath()` (`lib/auth.config.ts`) makes the admin-page
check a plain, path-aware function; `proxy.ts` checks the session directly
via `next-auth/jwt`'s `getToken()` (Edge-safe, JWT-decode only, no DB)
instead of wrapping `auth()` in a custom middleware function. The wrapped-
`auth()` form was tried first and reverted: a live test showed it does
**not** auto-apply the `authorized` callback's redirect — an unauthenticated
request to `/admin/catalog` got a `200` instead of a redirect to
`/admin/login`. The now-unused `authorized` callback was removed from
`lib/auth.config.ts` (confirmed via grep that nothing else references it).

Verified live (local dev server + browser): unauthenticated `/admin` and
`/admin/catalog` redirect to `/admin/login` with `x-request-id` set; an
authenticated session reaches `/admin/catalog` with `200` and
`x-request-id` present; public `/api/catalog` is unaffected (`200`); admin
API routes are unaffected (`401` via the pre-existing, untouched
`requireAdmin()`/`lib/api-auth.ts`).

## Log destination
`logEvent` writes structured JSON to `console.log`/`console.error` only —
no new I/O in the request path. On a self-hosted VPS/Docker deployment,
stdout is not ephemeral: Docker's default `json-file` logging driver (or
journald under systemd) already captures and rotates it. The app doesn't
own file-writing or retention — hand-rolling that would add blocking I/O to
the request path and a real multi-process corruption risk (PM2 cluster,
multiple containers writing the same file) for something the platform
already solves.

**Go-live checklist item** (tracked in `tasks/todo.md`, not code in this
branch): when deploy config is written, set the Docker `json-file` driver's
`max-size`/`max-file` (e.g. `--log-opt max-size=10m --log-opt
max-file=10`), or the journald equivalent, so retention is long enough to
be useful before logs roll off.

## What's deliberately not done yet
- `request.served` is defined in the taxonomy but not yet emitted anywhere
  — no route currently logs "this request was served, status X, took Y ms"
  as its own event. The events above log the *operation* (a search, a
  mutation, a send), not a generic per-request wrapper event. Adding
  `request.served` emission at each wrapped handler is a natural next step
  if a future need calls for it.
- Every other pre-existing `console.error` call site in the codebase is
  unchanged (see "Touched call sites" above).
- An autonomous analysis loop over these logs, full session replay, and a
  user-telemetry pipeline are explicitly out of scope — parked post-launch.

## Tests & verification
New: `proxy.test.ts`, `lib/log/{events,log,context,redact}.test.ts` (as
`log.test.ts`/`context.test.ts`/`redact.test.ts`), plus logging-behavior
tests added alongside each touched call site's existing test file
(`lib/authorize.test.ts`, `app/api/catalog/route.test.ts`,
`lib/stock.test.ts`, `lib/reference-crud.test.ts`,
`lib/customer-orders.test.ts`, `lib/email/send.test.ts`,
`app/api/newsletter/route.test.ts`). Existing tests for `lib/stock.ts`,
`lib/reference-crud.ts`, `lib/customer-orders.ts`, and every route that
calls `requireAdmin()` where this branch switched to `requireAdminUserId()`
were updated mechanically for the new required parameter/mock shape — no
previously-asserted behavior changed.
Full suite green after every commit (see `tasks/todo.md` for the current
baseline count).
