# Auth hardening

**Status:** branch `feature/auth-hardening` — merged to `master` (2026-07-05).

## Summary
Closes the two auth-hardening backlog items. One required real work (seed passwords);
the other turned out to be already implemented and is now verified + documented.

## 1. Seed admin passwords from the environment (real change)
The seed previously hardcoded `changeme123` for both admin accounts. Now:
- **`lib/seed-users.ts` → `resolveAdminSeedUsers(env)`** reads
  `SEED_ADMIN_SHOP_PASSWORD` / `SEED_ADMIN_DEV_PASSWORD` (min 8 chars; optional
  `SEED_ADMIN_{SHOP,DEV}_EMAIL` overrides) and **throws before any DB write** with a
  clear, var-naming message if they're unset or weak. Pure + unit-tested.
- **`prisma/seed.ts`** resolves the admin users via that helper instead of a hardcoded
  array. Verified live: `npm run db:seed` with no vars set fails loudly and touches
  nothing.
- **Docs:** `docs/instructions/admin-credentials.md` (env vars, seeding, rotation,
  handoff); `CLAUDE.md` setup notes the requirement.
- `.env.example` should list the new var names — flagged in the doc (env files are
  outside the assistant's write permissions).

## 2. Server-side session re-check on every admin mutation (already done)
Audited and confirmed the mutation surface is fully guarded — no new code needed:
- `requireAdmin()` (`lib/api-auth.ts`, `getServerSession`) is called in **every**
  `/api/admin/*` handler, including the managed-list routes (labels/genres/product
  types) via the shared `reference-crud` `collectionHandlers`/`itemHandlers` factory.
- `withAuth` middleware (`proxy.ts`) gates all `/admin` pages except login.
- Login verifies email + bcrypt via `authorizeCredentials`.
- Unit-tested: `lib/api-auth.test.ts` (401 without session, proceed with session).

## Tests & verification
- 5 new `resolveAdminSeedUsers` tests (255 total green): env passwords + default
  emails, email overrides, throws on missing / short / empty. `tsc` + lint clean.
- **Live:** seed fails loudly without `SEED_ADMIN_*` set, before any DB write.

## Operator follow-up (not code)
- Set real `SEED_ADMIN_*` passwords in `.env` / the deployment env and re-seed; rotate
  any DB previously seeded with `changeme123`. After first login, each admin changes
  their own password via `/admin/settings/users`.
