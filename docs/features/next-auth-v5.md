# next-auth v4 → v5 (Auth.js)

**Status:** branch `feature/next-auth-v5` — merged to `master` (2026-07-07).
`next-auth@5.0.0-beta.31`.

## Summary
Migrated from next-auth v4 (`authOptions` + `getServerSession` + `withAuth`) to Auth.js
v5 (central `NextAuth()` config exporting `{ handlers, auth, signIn, signOut }`),
clearing the `react ^18` peer warning that v4 carried on React 19.

## Structure (split config for the Edge middleware)
- **`lib/auth.config.ts`** (new, Edge-safe): pages, JWT session strategy, secret,
  `trustHost`, and the `authorized`/`jwt`/`session` callbacks. **No providers, no DB** —
  so the middleware doesn't pull Prisma into the Edge runtime.
- **`lib/auth.ts`** (Node): `NextAuth({ ...authConfig, providers: [Credentials(...)] })`
  with the db-backed `authorizeCredentials`. Exports `{ handlers, auth, signIn, signOut }`.
- **`proxy.ts`** (Next 16 middleware): `NextAuth(authConfig).auth` as the default export;
  the `authorized` callback redirects unauthenticated users to `/admin/login`.
- **`app/api/auth/[...nextauth]/route.ts`**: `export const { GET, POST } = handlers`.
- **`lib/api-auth.ts`**: `requireAdmin` now calls `auth()` (was `getServerSession`).
- **`AdminTopNav.tsx`**: `signOut({ callbackUrl })` → `signOut({ redirectTo })` (v5 rename).

## Env
- Secret is passed in the config as `process.env.NEXTAUTH_SECRET` (+ `trustHost: true`),
  so **no `.env` change is needed** — no rename to `AUTH_SECRET`. `authorizeCredentials`
  and the login page are unchanged.

## Verification
- `tsc` clean; **284 tests green** (`lib/api-auth.test.ts` now mocks `auth`).
- `next build` succeeded — the middleware compiled without pulling Prisma into Edge.
- **Live:** `/admin/login` → 200; `/admin/catalog` unauthenticated → 307 → `/admin/login`
  (middleware gate); `/api/auth/providers` lists the credentials provider;
  `/api/auth/csrf` and `/api/auth/session` respond; no `UntrustedHost`/`MissingSecret`.
- **Not verified:** submitting valid credentials (the login form needs a password, which
  the assistant doesn't enter). The flow is unchanged and `authorizeCredentials` is
  unit-tested; a human should do one real login before relying on it.

## Note
- `next-auth@5` is still labeled beta but is the standard pairing for Next 16.
