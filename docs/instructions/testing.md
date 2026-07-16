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

5. **Domain logic (`lib/`) gets full behavioural coverage, written first.** TDD:
   write the failing test that states the desired input→output, watch it fail,
   then implement. `lib/` is pure and framework-free precisely so it can be
   exhaustively tested this way.

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
