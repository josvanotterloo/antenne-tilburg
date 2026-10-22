# Instruction: Testing Philosophy

Binding for all work in this repo. The short version lives in `CLAUDE.md`
(## Testing Philosophy); this is the full treatment with rationale and examples.

Run the suite with the `run-tests` skill (`.claude/skills/run-tests/SKILL.md`) —
never hand-construct a test command.

## Principles

1. **Test behavior, not implementation.** The unit of a test is "when I call X
   with Y, I expect Z" — an observable contract — not "this component renders a
   `<div>` with class `mb-8`". If a refactor that preserves behavior breaks the
   test, the test was wrong.

2. **Never assert CSS classes, Tailwind utilities, or visual styling.** No
   `toHaveClass`, no `toHaveStyle`, no asserting on `className`, no checking for
   `mb-8` / `text-signal` / etc. These are brittle, break on every restyle, and
   verify nothing a user experiences.

3. **Styling-only changes get no tests.** A spacing, colour, hover, or
   line-height change has no behavioural surface to assert. Add zero tests and
   say so in the change description. (Do still verify it renders — in the
   browser, not in a unit test.)

4. **Component tests assert what the user sees and does.** Text content, the
   presence and destination of links, form submission, error and success
   messages, enabled/disabled state, which element has focus. Query by role and
   accessible name (`getByRole`, `getByLabelText`), not by test-id or class.

5. **Domain logic (`lib/`) gets full behavioural coverage.** The gate is
   coverage and mutation score (≥80%, via Stryker — see below), not the
   order tests and implementation were written in. See "TDD in the agent
   loop" below for why writing the test first is encouraged but not
   required from an agent.

6. **API routes test the contract, not the internals.** Assert status codes and
   response shape (`{ ok }`, `{ error }`, the returned fields) and the guard
   behaviour (401 when unauthenticated, 400 on bad input, 404/409 on the right
   conditions). Don't reach into how the handler computed the result.

7. **Never change an existing passing test to make new code pass.** If your
   change makes a green test go red, the default assumption is that your code is
   wrong, not the test. Only edit a test when the *behaviour it asserts* is
   genuinely being changed on purpose — and then say why.

## Test Contract

The principles above, sharpened into a contract. Also summarized in
`CLAUDE.md` (## Test Contract).

1. **Tests define the interface contract.** Code serves the tests, never the
   other way around. When code and a test disagree, the test is the record of
   what the interface promised.

2. **Never change an existing passing test to make new code pass.** If it
   breaks, the new code is wrong (principle 7 above, restated as contract).

3. **The only valid reason to change a test** is when the interface itself
   has deliberately changed — the behaviour the test asserts is being changed
   on purpose, not as a side effect.

4. **Interface changes are architectural decisions.** Always flag them
   explicitly and wait for user approval before proceeding. A commit that
   silently rewrites tests to fit new code has skipped that decision.

5. **Test behavior, not implementation.** "When I do X, I expect Y" — never
   CSS classes or internal function calls (principles 1–2 above).

6. **If you cannot test something behaviorally, that is a signal the design
   needs rethinking** — hard to test usually means hard to use: hidden state,
   missing seams, or an interface that doesn't say what it does.

7. **A shrinking test suite is a warning sign.** Removing tests requires
   explicit justification and user approval; a deleted test is a promise
   silently withdrawn.

## Examples

**Good — behaviour:**
```tsx
// The user sees a visible error when a mutation fails, and the list isn't refreshed.
it("shows a visible error when publish fails", async () => {
  stubFetch({ ok: false, json: async () => ({ error: "Slug already exists" }) });
  render(<PostActions post={post} />);
  fireEvent.click(screen.getByRole("button", { name: /publish/i }));
  expect(await screen.findByRole("alert")).toHaveTextContent(/slug already exists/i);
  expect(refresh).not.toHaveBeenCalled();
});
```

**Good — contract:**
```ts
it("400s invalid input and neither writes nor emails", async () => {
  const res = await post({ name: "", email: "nope" });
  expect(res.status).toBe(400);
  expect(db.newsletterSubscriber.create).not.toHaveBeenCalled();
});
```

**Bad — implementation / styling (do not write these):**
```tsx
expect(container.firstChild).toHaveClass("mt-4");        // styling
expect(button).toHaveClass("bg-admin-ink");              // styling
expect(wrapper.find("Combobox")).toHaveLength(1);        // internal structure
```

## Why

Behavioural tests survive refactors and document intent — they tell the next
person (or the next session) what the code is *for*. Class- and structure-level
assertions do the opposite: they lock in today's implementation, break on every
tidy-up, and give false confidence because they pass whether or not the feature
actually works. Testing what the user experiences is the only coverage that
earns its maintenance cost.

## TDD in the agent loop

Why Principle 5 above no longer requires writing the test first, and what
still does.

Classic red-green-refactor assumes a human writing a test, watching it
fail, then writing code to make it pass — two genuinely separate cognitive
moments, where the person specifying the behavior really doesn't yet know
the implementation. That separation doesn't hold when a coding agent
writes both the test and the implementation in the same generation: the
agent isn't specifying behavior it doesn't yet understand and then
discovering how to build it — it composes both from the same context in
the same pass. Watching the test fail before implementing is, in that
setup, a performative red step: proof of a screenshot, not a forcing
function. Böckeler ("TDD inside the agent loop," martinfowler.com, 2026)
found this costs 3–8x more tokens with no corresponding gain in defect
detection over writing the test and implementation together and verifying
after.

What actually matters is unchanged: **behavioral tests, not tautological
ones** (a test that asserts output against itself, or re-runs the same
logic to produce its own expected value, proves nothing), and **mutation
score ≥80% on `lib/`** (Stryker, below) as the real measure of whether the
suite would catch a real bug — not the order the test and the code were
typed in.

Writing the test first is still worth doing when a *human* is thinking
through complex logic — specifying input→output pairs before implementation
is a genuine design tool, because a human really doesn't know the
implementation yet while writing the test. That's exactly what a Gherkin
scenario in `features/*.feature` is: a human-authored spec, written before
an agent implements against it — real TDD, at the acceptance layer, because
the separation between specifying behavior and writing the implementation
is real when a human writes the spec and an agent (possibly in a later
session) implements it. Keep writing Gherkin scenarios and specs first.
Don't require an agent to perform the same separation when it's writing a
unit test and its implementation in one sitting.

## Additional Testing Layers

Four layers on top of the core Vitest unit/integration/contract suite above,
inspired by Uncle Bob's Acceptance→Unit pipeline. All the principles above
(behavior not implementation, full behavioural coverage, never weaken an
existing test) apply to these exactly as they do to ordinary unit tests.

### Gherkin/BDD acceptance tests

`features/*.feature` (Gherkin) + `features/step-definitions/*.test.ts`, run
via [`@amiceli/vitest-cucumber`](https://vitest-cucumber.miceli.click/) —
Gherkin scenarios execute as real Vitest tests, not through the standalone
`cucumber-js` CLI. This is deliberate: every existing "integration" test in
this repo fakes `db`/`email`/`auth` with Vitest's `vi.mock`, which the
standalone CLI can't use (it runs step definitions as plain Node files
outside Vitest). Running Gherkin through Vitest means acceptance tests get
`vi.mock` for free and are automatically swept into `npm test` / CI — no
separate acceptance-test CI step exists or is needed.

- Run: `npm run test:acceptance` (`vitest run features`), or just `npm test`.
- Step definitions call real route handlers / `lib/` functions directly —
  no browser automation, no HTTP server. See
  `docs/features/acceptance-tests.md`.

### Stryker mutation testing

`stryker.config.mjs` mutates all of `lib/` (`"lib/**/*.ts"`, test files
excluded) — a glob, not a curated file list, so a new `lib/` file is covered
automatically with no config edit needed. `app/` and `components/` are
excluded — UI mutation testing is too noisy to act on. If a specific `lib/`
file ever needs excluding (nothing meaningful to mutate, e.g. a thin
framework singleton), add a `"!lib/..."` negation line with a comment
explaining why — don't silently narrow the glob back to a list.

- Run: `npm run test:mutate` (`stryker run`). **Not** wired into CI or
  `scripts/run-tests.sh` — a full run takes ~2 minutes and isn't a
  per-push gate. Run manually after meaningful changes to the mutated
  files, or periodically to catch drift.
- Goal: mutation score ≥80%. When a mutant survives, the fix is a new or
  strengthened *behavioral* test for the real gap the mutant exposed —
  never a test shaped around the specific mutant (e.g. a contrived input
  no real caller would ever produce, just to hit a regex-boundary
  character). If mutation testing surfaces a test like that, re-derive a
  realistic scenario that exercises the same code path instead.
- See `docs/features/mutation-testing.md`, including a documented
  Stryker↔Vitest 4 runner discrepancy found while chasing one file's score.

### CRAP (Change Risk Analyzer and Predictor)

`scripts/crap-report.mjs` — a small in-repo script, not the third-party
`crapper` CLI (running that would mean executing an unreviewed tool as a
subprocess of `npm install` and the test suite; see the script's own header
comment for the reasoning). It computes the same formula using tooling
already in this project's trust boundary: TypeScript's compiler API for
cyclomatic complexity, Vitest's own v8 coverage for the coverage fraction.

- **What it measures**: a per-function score, `CRAP = complexity² × (1 −
  coverage)³ + complexity` (complexity = cyclomatic complexity, coverage =
  the 0–1 fraction of that function's lines covered). High only when a
  function is **both** complex **and** under-tested — the combination that
  makes it genuinely risky to change. A complex function with full coverage
  scores low (the `(1 − coverage)³` term drops to 0, leaving just
  `complexity` as a floor); a trivial, uncovered function also scores low
  (complexity near 1).
- **How it differs from Stryker, and why both exist.** Stryker proves
  whether the tests that already exist actually catch a bug (deep, slow,
  `lib/`-only, periodic). CRAP is a fast, whole-surface triage that points
  at *where* coverage is missing on complex code — it's how you decide what
  to write a behavioral test for next, or where to aim the next mutation
  run. Complementary, not redundant: CRAP finds the gap, Stryker verifies
  the fix actually closes it.
- **How we use it: advisory, not a gate.** Not wired into CI or
  `scripts/run-tests.sh`, and not a close-out blocker — the same reasoning
  that keeps Stryker out of CI. A high score is a prompt to add a
  *behavioral* test for that function — never a test shaped around the
  score itself. Intentionally complex code will score high regardless of
  coverage (e.g. `markdownToHtml`, already a known hotspot — see the Debt
  note in `docs/qa/claude-code-prompts-revised-5-6.md`); a hard
  threshold-gate on this metric would just be noise.
- Run: `node scripts/crap-report.mjs` (`lib/` by default; pass a different
  directory as the one argument). Run periodically — alongside a mutation
  run, or whenever deciding what to test next — not on every push.
- Scope: `lib/` only, same as Stryker.
- **Look-at-this threshold: 30** — CRAP's conventional cutoff, carried over
  unconfirmed. Flagging this specifically as a number to agree on, not an
  established rule for this repo yet. A score above it is worth a look, not
  an automatic action.

### fast-check property tests

`describe("property", ...)` blocks inside the *existing* `lib/*.test.ts`
files (not separate files) using [fast-check](https://fast-check.dev/).

- Run: `npm run test:property` (`vitest run --reporter=verbose -t property`
  — filtered by test name, since these live inside existing test files).
  Also runs automatically as part of `npm test` / CI.
- Before writing a property, verify it's actually true against the real
  implementation — don't assume a plausible-sounding property holds. Two
  properties in this codebase were corrected after tracing the code
  disproved the naive version (`buildCatalogOrderBy` doesn't always
  return an array; `markdownToHtml` doesn't always return non-empty
  output for blank input). See `docs/features/property-tests.md`.
- fast-check runs unseeded by default (100 random inputs per property).
  This is a feature, not flakiness: if a property test fails intermittently,
  treat it as a real signal and read fast-check's shrunk counterexample —
  it may point at a genuine edge case in the code under test, or (as
  happened twice while adding this layer) at the property test's own
  input construction combining generated values in a way that breaks the
  specific case under test. Either way, don't retry it away.
