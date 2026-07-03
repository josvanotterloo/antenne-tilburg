# Instruction: Generate a new module (Next.js App Router)

TDD discipline for adding a new unit of code to this project — an admin CRUD
section, a public page pulling real data, an API route, or a shared component.

## Role

You are implementing a new module in the Antenne Tilburg app (Next.js 14 App
Router + TypeScript + Prisma + NextAuth + Tailwind). Follow this instruction
exactly. Do not write code before completing the context requirements.

## Branching

Follow `docs/instructions/branching.md` before writing any code.

## Context requirements

Before writing any code, read:
- `docs/antenne-tilburg-website-plan.md` — the domain spec (fields, rules,
  which lists are admin-managed, the "Just In" / notices / opening-hours logic).
- `prisma/schema.prisma` — the source of truth for data shapes and relations.
- The closest existing example of what you're adding, so you match its patterns:
  - Admin section → `app/admin/<section>/page.tsx` (all currently placeholders).
  - Public page → `app/(public)/<page>/page.tsx`.
  - Data access → `lib/db.ts` (always import the `db` singleton; never `new
    PrismaClient()` outside `lib/db.ts` and `prisma/seed.ts`).

## Before Writing Any Code

State explicitly:
1. Your interpretation of the spec
2. Any ambiguities or missing information
3. The simplest implementation that meets the goal
4. What passing tests will prove it is done

Only proceed after confirming these with the user.

## Project conventions (must follow)

- **TypeScript throughout** — no plain JS.
- **Prisma access via the `lib/db.ts` singleton.** Do the DB work in a Server
  Component or a Route Handler / Server Action, never in a Client Component.
- **Server vs Client:** default to Server Components. Add `"use client"` only
  when you need state, effects, or event handlers (e.g. forms).
- **Auth:** `/admin/*` is already gated by `proxy.ts`. For mutations, also
  re-check the session server-side (`getServerSession(authOptions)`) — never
  trust the client. Reject unauthenticated writes before any DB call.
- **Validation at the boundary:** validate/parse all input before any I/O; reject
  bad input first. Guard destructive deletes (e.g. don't delete a Label/Genre/
  ProductType that still has linked products — surface a clear error instead).
- **Managed lists drive filters:** public stock filtering and admin forms both
  read Label / Genre / ProductType from the DB — keep them consistent.
- **SEO:** export `metadata` (or `generateMetadata`) per page; fall back to
  sensible defaults when `seoTitle` / `seoDescription` are unset.
- **Resilience:** public server components that read the DB should degrade
  gracefully if the query fails (see `NoticeBanner` / `SiteFooter`).

## TDD order

1. Write the failing test first; run it to confirm RED.
2. Implement the minimum to pass; confirm GREEN.
3. Write the test file(s) before committing the implementation file.
4. Run `npm run typecheck` and `npm run lint` after implementation — zero new
   errors. Use the `run-tests` skill to run tests; never hand-roll test commands.

## Close-out

Follow the close-out checklist in `docs/instructions/branching.md` before ending
the session.
