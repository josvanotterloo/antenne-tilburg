# Project Instructions

Global rules in `~/.claude/rules/common/` that conflict with this project's
docs are superseded by this file. Project-specific docs take precedence.
Conflicting files: `testing.md` (superseded by `docs/instructions/testing.md`),
`patterns.md` (superseded by `docs/instructions/generate-route.md`),
`development-workflow.md` (superseded by `docs/instructions/branching.md`),
`security.md` (superseded by CI gates and the OWASP audit — see
`docs/instructions/ci.md` and `docs/security/owasp-audit-2026-07-09.md`).

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
- Testing philosophy: see `docs/instructions/testing.md`
- Session log template: see `docs/session-log-template.md`

## Testing
Run tests: see `.claude/skills/run-tests/SKILL.md` — always use the run-tests skill,
never construct custom test commands.
CI runs the full suite on every push via GitHub Actions (see
`docs/instructions/ci.md`). Claude Code runs tests during TDD only, not as a
pre-merge verification step.

## Code Discipline
Binding for all work in this repo.

- **Read every file you will touch before touching it** — read, not skim.
- **State your assumptions before writing code**; flag tradeoffs explicitly.
- **Write the minimum code that solves the current problem** — not the future
  one.
- **Your diff should be as small as the task allows** — do not touch what you
  were not asked to touch.
- **When fixing a bug: write the failing test first, watch it fail, then
  fix.** This proves you found the cause, not the symptom.
- **Specs are acceptance criteria**: "reject X, return 400, test both cases" —
  not "add validation".
- **If you find yourself restructuring code you were not asked to change,
  stop and ask.**

## Testing Philosophy
Binding for all work in this repo. Full version: `docs/instructions/testing.md`.

- Test **behavior, not implementation**: "call X with Y → expect Z", never "this
  element has class `mb-8`".
- **Never** assert CSS classes, Tailwind utilities, or visual styling. A
  styling-only change adds **no** tests.
- Component tests assert what the user sees and does — text, links, form
  submission, error messages, enabled/disabled state — not how it looks.
- Domain logic (`lib/`) gets full behavioral coverage written **before** the
  implementation (TDD).
- API routes: test the **contract** — status codes and response shape — not
  internals.
- **Never** change an existing passing test to make new code pass. If an
  existing test breaks, the new code is wrong.

## Test Contract
Binding for all work in this repo. Full version: `docs/instructions/testing.md`
(§ Test Contract).

- **Tests define the interface contract** — code serves the tests, never the
  other way around.
- **Never change an existing passing test to make new code pass** — if it
  breaks, the new code is wrong.
- **The only valid reason to change a test** is when the interface itself has
  deliberately changed.
- **Interface changes are architectural decisions** — always flag them
  explicitly and wait for user approval before proceeding.
- **Test behavior, not implementation** — "when I do X, I expect Y", never
  CSS classes or internal function calls.
- **If you cannot test something behaviorally**, that is a signal the design
  needs rethinking.
- **A shrinking test suite is a warning sign** — removing tests requires
  explicit justification and user approval.

## Autonomy

### Long-running tasks
For any task expected to take more than 30 minutes or touch more than 5 files:
- Commit after every logical unit of work completes successfully
- Each commit must leave the codebase in a passing state (tests green, no broken imports)
- Use descriptive commit messages: "fix: resolve lint errors in App.jsx (12/69)"
- Never leave uncommitted changes when stopping — partial progress in git is
  recoverable, partial progress in the working tree is not

This ensures session-limit interruptions preserve progress rather than losing it.

## Session Management
- For any task touching more than 3 files: use Plan Mode (/plan) before writing any code — get approval on the approach before implementation starts
- When errors increase in a long session or Claude makes repeated wrong assumptions: use /rewind rather than manually undoing changes
- Use /context to inspect the context window if Claude makes unexpected assumptions about the codebase
- Update tasks/lessons.md immediately when a new pitfall is discovered — do not wait until close-out
- Do not block the main thread: while Claude Code is running a long task, use the time to plan the next one, review docs, or make decisions that will be needed later
- Context degrades in long sessions — if a session has been running for more than 2 hours or 10+ feature commits, start a fresh session with a clean handoff prompt rather than continuing in a degraded context window

## When to run /code-review

Run /code-review:
- Any change to auth, security, encryption, or payment logic
- Any new API route or change to an existing API contract
- Any architectural decision (new lib/ module, new data model, new third-party integration)
- Any change touching more than 5 files
- Before any production deployment

Skip /code-review (rely on CI instead):
- Pure styling changes (CSS, Tailwind classes)
- Copy/content changes
- Documentation and config updates
- Test-only changes with no production code touched
- Minor bug fixes to a single, well-tested function

CI handles security scanning (semgrep + npm audit) and test verification
automatically on every push. /code-review is reserved for architectural
judgment that automated tools cannot replace.

## Prompting Tips
For complex or ambiguous tasks, prefix your prompt with `ultrathink` to trigger
high-effort reasoning before starting.
