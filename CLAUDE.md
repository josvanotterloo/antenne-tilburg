# Project Instructions

Antenne Tilburg — website for Antenne Recordshop (electronic-music vinyl & tapes,
inside Sam-Sam vintage, Tilburg). Public site + admin for products, blog, events,
notices, opening hours, newsletter and want-list. Full spec:
`docs/antenne-tilburg-website-plan.md`.

Stack: Next.js 16 (App Router, TypeScript) · React 19 · Prisma + PostgreSQL ·
next-auth v5 (credentials, JWT) · Tailwind CSS.

## Setup
`npm install`, then `npm run dev` to start the dev server on http://localhost:3000.
Copy `.env.example` to `.env` and set `DATABASE_URL` / `NEXTAUTH_SECRET` first.
Seeding also requires `SEED_ADMIN_SHOP_PASSWORD` / `SEED_ADMIN_DEV_PASSWORD` (min 8
chars) — admin passwords are never hardcoded; see `docs/instructions/admin-credentials.md`.
Subscriber emails are encrypted at rest: set `EMAIL_ENCRYPTION_KEY`
(`openssl rand -hex 32`); see `docs/features/email-encryption-at-rest.md`.
Run `npm run prisma:migrate` and `npm run db:seed` to create and seed the database.

## Current Tasks
See `tasks/todo.md` — active work, backlog, and done items.

## Permanent Lessons
See `tasks/lessons.md` — mistake memory. After any correction from the user, add a
row to `tasks/lessons.md` immediately with the date, mistake, and rule.

## Instructions
- Branching rules: see `docs/instructions/branching.md`
- Generate a new module/route: see `docs/instructions/generate-route.md`
- Interrogate before generating: see `docs/instructions/interrogate.md`
- Session log template: see `docs/session-log-template.md`

## Testing
Run tests: see `.claude/skills/run-tests/SKILL.md` — always use the run-tests skill,
never construct custom test commands.

## Autonomy

### Long-running tasks
For any task expected to take more than 30 minutes or touch more than 5 files:
- Commit after every logical unit of work completes successfully
- Each commit must leave the codebase in a passing state (tests green, no broken imports)
- Use descriptive commit messages: "fix: resolve lint errors in App.jsx (12/69)"
- Never leave uncommitted changes when stopping — partial progress in git is
  recoverable, partial progress in the working tree is not

This ensures session-limit interruptions preserve progress rather than losing it.

## Prompting Tips
For complex or ambiguous tasks, prefix your prompt with `ultrathink` to trigger
high-effort reasoning before starting.
