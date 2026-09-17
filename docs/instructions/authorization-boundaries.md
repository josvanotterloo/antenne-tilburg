# Instruction: Authorization Boundaries

Binding for all work in this repo.

## Rule

Every admin API route handler performs its own session check. Middleware
(`lib/api-auth.ts`'s `requireAdmin`, called by `proxy.ts` for *pages* only)
protects page navigation — it does not protect `/api/admin/*` handlers.

Route handlers are independently addressable POST/PATCH/PUT/DELETE endpoints.
They can be invoked directly (curl, fetch, a script) without ever loading the
admin page that renders a button for them. A page-level redirect for
unauthenticated visitors gives zero protection to the endpoint itself.

**No mutation may rely on "this route is only reachable from a protected
page."** If `requireAdmin()` (or equivalent) is not called inside the
handler, the check does not exist.

This project has no role tiers — two equal admin accounts, no `role` field
(see `prisma/schema.prisma`, Session model comment). So "authenticated" and
"authorized" are the same check here: `requireAdmin()` returning non-null
short-circuits with 401. If role tiers are ever introduced, every mutation
must also assert the caller's role, not just that a session exists.

Applies to every create, update and delete across `app/api/admin/*` (and to
any future Next.js Server Action, which is the same class of directly
addressable endpoint under a different syntax).

## How to apply

- New route handler: call `requireAdmin()` (or use the shared
  `collectionHandlers`/`itemHandlers` factories in `lib/reference-crud.ts`,
  which already do this) as the first line of every exported `GET`/`POST`/
  `PATCH`/`PUT`/`DELETE`, not just once somewhere in the file.
- New Server Action (`"use server"`): same rule — check the session inside
  the action itself, not just on the page that calls it.
- Tests for admin mutations must include an unauthenticated case
  (expect 401) — not only the happy path. A lower-privilege authenticated
  case is only relevant once role tiers exist.

## Audit log

- 2026-09-17: Audited every `app/api/admin/**/route.ts` handler. All mutating
  handlers call `requireAdmin()` directly (either inline or via the shared
  `lib/reference-crud.ts` factories) and all have at least one unauthenticated
  401 test. No violations found. No `"use server"` actions exist in the repo.
