# Session Log — 2026-07-31

## What was built
- Full stock/inventory management system: `Supplier` → `SupplyOrder` →
  `SupplyOrderLine` → `StockTransaction` data model, a shared floor-at-zero
  ledger engine (`lib/stock.ts`), Supplier CRUD admin, Supply Orders admin
  (list/create/edit/detail/receive, with re-receiving a `PARTIAL` order),
  a stock-transaction history section on the product edit page, and the
  Catalog sub-nav to hold it all. `Product.quantity` is now derived
  exclusively from the ledger — the admin form no longer accepts it directly.
- Brainstormed and spec'd (`docs/superpowers/specs/2026-07-29-stock-management-design.md`),
  planned as 21 tasks (`docs/superpowers/plans/2026-07-29-stock-management.md`),
  executed via subagent-driven development — one implementer + one task
  reviewer per task, plus two ad hoc follow-up tasks discovered mid-run.

## What worked
- Subagent-driven execution with a task reviewer on every single task caught
  real, load-bearing bugs before they could compound: a migration silently
  dropping three unrelated search indexes (Task 1), a duplicate-line-id gap
  and an untestable transaction-atomicity test double in the receive route
  (Task 17), and a sub-nav double-active-state plus a delete-then-404 bug in
  the final UI assembly task (Task 19). None of these would have been caught
  by "trust the implementer's self-report."
- The plan's briefs carried complete, exact code for almost every task,
  which made implementer dispatches cheap (mostly `haiku`) and fast, with
  `sonnet`/`opus` reserved for the riskiest tasks (the receive route, the
  final UI assembly) and for reviews.
- The mandatory manual browser walkthrough at close-out (per `branching.md`)
  caught a real bug that 778 passing automated tests did not: a nested
  `<form>` that real Chrome refuses to submit but jsdom tolerates. This is
  exactly the gap that instruction exists to cover.

## What drifted from intent
- The original plan under-specified two things that only surfaced during
  execution: an existing Gherkin acceptance test whose premise the approved
  design change broke (required a human decision, mid-run, on whether to fix
  it immediately or defer — fixed immediately, then restored fuller coverage
  once the adjust route existed), and the running-balance display direction,
  where the plan's own wording ("last entry equals the final balance") was
  backwards relative to the code it specified. Both were caught by task
  reviews, not by re-reading the plan.
- Two environment gaps had nothing to do with the code: a fresh worktree's
  `.env` (copied from the main checkout) was missing `SEED_ADMIN_*_PASSWORD`
  (no seeded users at all) and, separately, missing `.env.local` entirely
  (holding `NEXTAUTH_SECRET`) — login failed with a `MissingSecret` auth
  error until both were sorted out. Neither was a code defect; both cost
  real back-and-forth during the manual verification step.
- A third environment gap surfaced only at the very last step — verifying
  the merged result on `master` per `finishing-a-development-branch`: Vitest
  and ESLint both discovered/ran the nested `.worktrees/feature-stock-management/`
  copy of the repo when invoked from the main checkout (neither tool's
  default ignores cover a nested worktree), loading a second copy of React
  into the test process and producing ~190 unrelated test failures and
  ~9000 bogus lint errors. A stale, never-regenerated Prisma Client in the
  main checkout (schema changes had only ever been `prisma generate`'d
  inside the worktree) caused a further ~10 real `tsc` errors on top of that.
  All three were config/environment issues, not code defects, but all three
  would have blocked or badly confused a push had the "verify on the merged
  result" step been skipped.

## Signal (what should change in a shared artifact)
- [ ] Context:
- [ ] Instruction:
- [x] Workflow: worktree setup for local dev should copy every `.env*` file
      the source checkout has, not just `.env` — see `tasks/lessons.md`
      2026-07-31.
- [x] Failure: a full green test suite does not prove a nested `<form>`
      submits in a real browser — see `tasks/lessons.md` 2026-07-31b.
- [x] Workflow: `vitest.config.ts` and the ESLint flat config both need
      `.worktrees/**` excluded, and `prisma generate` needs a re-run in any
      checkout that merges in schema changes — see `tasks/lessons.md`
      2026-07-31c.
- [ ] None

## Friction points
- The user hit a real login failure (missing `NEXTAUTH_SECRET`) and a real
  "adjust stock does nothing" bug independently, both during their own
  manual walkthrough — in both cases the fix required going around the
  automated suite entirely (direct DB queries, live network inspection,
  reproducing the exact click sequence) since the suite was green throughout.
  A prompt that would have prevented some of this: front-load "copy every
  `.env*` file, not just `.env`" into the worktree-setup step itself, rather
  than discovering the gap only when login failed.

## Updates made
- `docs/features/stock-management.md` (new)
- `docs/features/stock-quantity.md` (superseded-by pointer added)
- `tasks/lessons.md` (+3 rows: worktree `.env*` copying, nested-form/jsdom
  gap, worktree-vs-Vitest/ESLint/stale-Prisma-Client gap)
- `tasks/todo.md` (moved to done)
- `vitest.config.ts` / `eslint.config.mjs` (exclude `.worktrees/`)

## Code review
- Code review: run via `/code-review`. 9 findings; 3 real bugs fixed in one
  wave (Product delete FK-restriction 500, sub-nav highlighting nothing on
  unlisted sub-paths, non-deterministic running-balance order for
  same-timestamp transactions) and independently re-verified after the
  scoped re-review subagent hit a spend limit mid-run. The other 6 findings
  were parked: one already-documented accepted limitation, one verified
  false positive, four discretionary/cosmetic DRY notes.
