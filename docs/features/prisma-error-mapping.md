# Shared Prisma-error-to-HTTP mapper (2026-11-23)

Second item from the 2026-11-20 repeated-mistakes audit. Replaces every
route's own `(error as {code?:string}|null)?.code === "P2025"` cast-and-
compare (16 occurrences across 14 route files + `lib/reference-crud.ts`)
with one shared module, `lib/prisma-error.ts`.

## Codes handled

Only the three Prisma error codes this repo's `app/` and `lib/` code
actually reference anywhere (confirmed by grepping every `"P2\d{3}"`
literal): `P2002` (unique constraint), `P2025` (record/relation not
found), `P2003` (foreign key constraint).

## API: explicit handlers, no implicit default

```ts
const response = prismaErrorResponse(error, {
  P2025: NOT_FOUND,
  P2003: { status: 400, body: { error: "Selected supplier no longer exists" } },
});
if (response) return response;
throw error;
```

`mapPrismaError`/`prismaErrorResponse` only produce a response for a code
explicitly listed in the call's `handlers` object — nothing is applied by
default. **This went through two designs.** The first version had
`mapPrismaError(error, overrides?)` fall back to a built-in default table
for any known code not given an override, on the theory that "every route
already agrees P2025 means 404, P2002 means 409" — true for the codes
each route already checked, but the first version applied the default to
*every* known code regardless of whether that route had ever handled it
before. `/code-review` (run per CLAUDE.md's "new lib/ module" + ">5
files" triggers, as this task required) caught that this silently widened
several routes' handled-code surface: a P2002 or P2003 on a product
write, previously an unhandled 500 visible to Sentry via
`instrumentation.ts`'s `onRequestError`, would have started returning a
generic 409 with no server-side signal at all. Findings:

- `app/api/admin/labels/[id]/route.ts` and `labels/route.ts`: a dangling
  `supplierId` (a plain scalar FK — see `prisma/schema.prisma`'s
  `Label.supplierId`, not a nested `connect`) throws **P2003**, which the
  first version's default mapped to "Still referenced by other records" —
  backwards; the label isn't in use, its *own* supplier reference is
  gone. Fixed with an explicit, correct override: 400 "Selected supplier
  no longer exists", the same wording pattern `products/route.ts` already
  uses for the analogous nested-connect case. New tests cover this in
  both files' `.test.ts`.
- `app/api/admin/artists/[id]/route.ts` (PATCH only ever checked P2002),
  `app/api/admin/notices/[id]/route.ts` (only ever checked P2025), and
  the newsletter signup route (only ever checked P2002) would all have
  started silently handling codes they never considered, each losing the
  unhandled-500-reaches-Sentry signal for a genuinely unexpected case.

The second (current) design requires `handlers` on every call and ships
three named constants (`NOT_FOUND`, `ALREADY_EXISTS`, `STILL_REFERENCED`)
for the common case, so a route reuses one instead of retyping
`{status: 404, body: {error: "Not found"}}` — but always by explicitly
listing it, never implicitly. Every migrated route now handles *exactly*
the codes it handled before migration, confirmed by re-diffing each
route's catch block against its pre-migration version.

## Exhaustiveness: does a `never` default work against Prisma's own types?

No. Checked directly against the installed `@prisma/client` (6.19.3):
assigning `PrismaClientKnownRequestError.code` to a `"P2002"`-literal
variable fails with `Type 'string' is not assignable to type '"P2002"'`.
Prisma does not export a union/enum of known error codes — `.code` is
plain `string`. The `never`-default switch in `commonResponseFor()` is
exhaustive only over this module's own closed `KnownPrismaErrorCode`
union (`"P2002" | "P2025" | "P2003"`): it catches a code added to that
union without a matching case here, nothing more. An undocumented Prisma
code Prisma returns isn't "known" and falls through `isKnownCode()`'s
`false`, the same as any other unmapped error — callers rethrow it.

## Not migrated: `lib/encrypt-legacy-subscribers.ts`

Still has its own `(error as {code?:string}|null)?.code === "P2002"`
cast — deliberately. It's a one-time backfill script, not a route (no
HTTP response to produce; a hash collision is logged and skipped, not
mapped to a status code). The task scope was "every mutation route."

## Proven against history

- **8c36753** (2026-07-02): before this commit, `DELETE
  /api/admin/products/[id]` called `db.product.delete` with no try/catch
  at all, and `lib/reference-crud.ts`'s POST/PATCH had no catch either —
  confirmed via `git show 8c36753^:...`. A P2025 or P2002 propagated as
  an unhandled exception. `lib/prisma-error.test.ts`'s regression
  describe block demonstrates the same codes, handled, now resolve to
  404/409.
- **a97258e** (2026-07-10): same shape — `PATCH
  /api/admin/products/[id]` had no try/catch around `db.product.update`
  before this commit (`git show a97258e^:...`).
- **dff0130** (2026-10-15): does **not** demonstrate a gap this mapper
  closes. Its actual bug was `applyStockTransaction`'s `{ok:false}`
  result thrown as a bare `Error`, which the route's P2025-only catch
  didn't recognize — not a Prisma error at all. The real fix (a
  `StockWriteFailed` class checked with `instanceof` before the Prisma
  mapping) is untouched and unrelated to this module.

## Not changed: newsletter signup's duck-typed check

`app/api/newsletter/route.ts` previously used `error instanceof
Prisma.PrismaClientKnownRequestError && error.code === "P2002"` — a
stricter check than `prismaErrorCode`'s duck-typed `.code === "P2002"`,
flagged by `/code-review` as a precision loss on a public,
non-enumerating endpoint. Not fixed: every other route's existing tests
mock Prisma errors as plain `{code}` objects, not real
`PrismaClientKnownRequestError` instances, so adding `instanceof`
centrally would fail across the whole suite (Test Contract), and adding
it only for this one file would reintroduce the exact per-route
inconsistency this module exists to remove. The only code this catch
block can reach is from `db.newsletterSubscriber.create` on a flat
`data` object with no relations — not a reachable gap today.

## Verification

Full suite (174 files / 1325 tests), lint, and typecheck all clean after
the migration and after the redesign following `/code-review`.
`/code-review high master..refactor/prisma-error-mapper` run per
CLAUDE.md's mandatory triggers (new `lib/` module; 16 files touched).
