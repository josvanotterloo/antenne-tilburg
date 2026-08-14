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

Three layers on top of the core Vitest unit/integration/contract suite above,
inspired by Uncle Bob's Acceptance→Unit pipeline. All three principles above
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

`stryker.config.mjs` mutates `lib/`'s pure, framework-free core (currently
`catalog.ts`, `email/render.ts`, `token.ts`, `authorize.ts`, `blog.ts`,
`notice.ts`, `rss.ts` — the exact set asked for in the session that added
this, not a claim that every pure `lib/` file is covered). `app/` and
`components/` are excluded — UI mutation testing is too noisy to act on.

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
