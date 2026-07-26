# Session Log — 2026-07-26

## What was built
- First of three new testing layers (Gherkin acceptance, Stryker mutation,
  fast-check property) requested for the top 5 user journeys, Uncle Bob
  Acceptance→Unit pipeline style.
- `@amiceli/vitest-cucumber` + 5 `.feature` files + 5 step-definition
  files under `features/`, exercising real route handlers / `lib/`
  functions with the repo's existing `vi.mock` conventions.
- `docs/features/acceptance-tests.md`.

## What worked
- Reusing the repo's own mocking conventions (same `vi.mock` shapes as
  `newsletter-flow.integration.test.ts`, `products.test.ts`) made the step
  definitions straightforward once the tooling choice was settled.
- Breaking real `lib/` code temporarily (then reverting) to prove two
  code-review findings were genuine, and that the fixes actually caught
  the regression — cheap and conclusive.

## What drifted from intent
- The user's literal spec asked for the standalone `@cucumber/cucumber`
  CLI + `@cucumber/html-formatter` and a `cucumber-js features/` script.
  Investigating this repo's test conventions surfaced a real blocker: no
  test double mechanism exists outside Vitest's `vi.mock`, and `sendEmail`
  throws without real Resend credentials. Raised as an AskUserQuestion
  before writing any code; the user chose running Gherkin through Vitest
  (`@amiceli/vitest-cucumber`) instead. `test:acceptance` became `vitest
  run features`, and `@cucumber/html-formatter` was dropped.

## Signal (what should change in a shared artifact)
- [ ] Context:
- [ ] Instruction:
- [x] Workflow: Session Management section (Plan Mode for >3-file tasks)
      added to CLAUDE.md just before this task, and it correctly triggered
      here — worth keeping.
- [ ] Failure:
- [ ] None

## Friction points
- `/code-review` is configured with `disable-model-invocation` — I cannot
  trigger it myself even though `branching.md` makes it a mandatory,
  no-exceptions gate. Had to stop and ask the user to run it. No prompt
  would prevent this — it's a deliberate, correct restriction (review
  shouldn't self-administer); worth documenting so future sessions don't
  waste a turn trying.
- vitest-cucumber's `BeforeEachScenario` hook must be destructured from the
  top-level `describeFeature` callback, not the inner `Scenario` callback —
  first attempt put it in the wrong scope and it silently ran before every
  step instead of once per scenario, wiping shared state between Given/
  When/Then. Caught by the RED-first TDD step, not by luck.

## Updates made
- `package.json`: `@amiceli/vitest-cucumber` dev dependency,
  `test:acceptance` script.
- `features/*.feature` (5), `features/step-definitions/*.test.ts` (5).
- `docs/features/acceptance-tests.md`.
