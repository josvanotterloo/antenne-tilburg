# Session Log — 2026-07-26

## What was built
- Second of three new testing layers: Stryker mutation testing scoped to
  7 `lib/` core files.
- `lib/rss.test.ts` from scratch (previously untested), plus new
  behavioral tests in `lib/blog.test.ts` and `lib/email/render.test.ts`
  covering real gaps mutation testing surfaced.
- `docs/features/mutation-testing.md`.

## What worked
- Scoping a diagnostic Stryker run to a single file (`--mutate "lib/x.ts"`)
  during iteration instead of the full 7-file, ~2-minute run kept the
  feedback loop fast (~25-45s) while chasing individual files' scores.
- Manually applying a survived mutant by hand (temporarily editing the
  real source, running the specific test, reverting) to prove a test
  fix actually works — same technique used in the acceptance-tests
  session, now applied to mutation testing itself.

## What drifted from intent
- `render.ts` didn't reach 80% individually even after two rounds of
  real behavioral tests (57.56% → 74.37%). Traced the remaining
  survivors by hand and found several are provably real bugs when
  manually applied (a loop-condition mutant that throws a TypeError)
  but Stryker's vitest-runner reports them as "Survived" rather than
  failing — looks like a Stryker↔Vitest 4 compatibility gap. Stopped
  chasing it once the *overall* 80% target was met (83.08%), rather than
  spend unbounded time debugging third-party tooling internals for one
  file's number.

## Signal (what should change in a shared artifact)
- [ ] Context:
- [ ] Instruction:
- [ ] Workflow:
- [x] Failure: mutation-testing-driven test writing can produce tests
      shaped around a specific mutant (unrealistic synthetic input)
      rather than real behavior — worth a general reminder to re-derive
      a realistic scenario for the same code path before accepting a
      mutant-killing test as final. Caught this time via `/code-review`.
- [ ] None

## Friction points
- Same `/code-review` `disable-model-invocation` restriction as last
  session — had to stop and ask the user to run it again. Consistent,
  expected, no action needed.
- `npm audit` picked up 2 new transitive vulnerabilities from Stryker's
  own dependency tree (`qs`, `typed-rest-client`, both moderate) on top
  of the pre-existing `next`/`next-auth`/`postcss`/`sharp` set. Dev-only
  dependency, not shipped to production; noted but not acted on.

## Updates made
- `package.json`: `@stryker-mutator/core`, `@stryker-mutator/vitest-runner`
  dev dependencies, `test:mutate` script.
- `stryker.config.mjs`.
- `.gitignore`: `/reports/`, `.stryker-tmp/`.
- `lib/rss.test.ts` (new), `lib/blog.test.ts` and `lib/email/render.test.ts`
  (additions).
- `docs/features/mutation-testing.md`.
