# Instruction: Documentation — examples, not prose

Binding for all work in this repo. Based on Rakhim Davletkaliyev's
["Examples are the best documentation"](https://rakhim.exotext.com/examples-are-the-best-documentation):
a reference doc tells you everything a function does; an example tells
you, in one glance, what calling it actually looks like — which is
usually the only thing you came to check. Reference text still carries
the details an example can't show without being verbose; the example
sits beside it, not instead of it.

## `lib/` functions

An exported `lib/` function whose behaviour isn't obvious from its name
and signature gets a doc comment with **2–5 input→output examples**.
Include at least one edge case (empty input, a boundary value, `null`)
and one failure case (what it throws or returns on bad input). If the
function is normally called alongside another one — a validator before
a writer, a formatter before a sender — say so and name it.

A function whose behaviour *is* obvious from its name and types (a
one-line wrapper, a trivial getter) gets no examples. Padding simple
code with examples buries the ones that actually earn their place. When
you touch a file and find a comment that only restates what the code
already says, delete it.

## Examples must be true

An example is a claim about behaviour, and claims need evidence: every
example's input and expected output must match an assertion in an
actual test, not just look plausible. The test is the source of truth —
if the two ever disagree, the comment is wrong, not the test. Name the
test (or point at its file) from the comment, so the link is checkable
without re-deriving it. A code review that finds an example with no
matching test treats that as a defect, the same as a wrong one.

## API routes

Document the contract with one example request and response, in the
route's own doc comment or in its `docs/features/*.md` entry — whichever
already carries the route's write-up. Include the error responses that
actually apply: 401 (unauthenticated), 400 (bad input), 409 (conflict),
wherever the route returns them.

## Scripts

A one-line (or short) usage example at the top of the file — the exact
command to run it, the way `scripts/clean-migration.ts` and
`scripts/check-npm-audit.mjs` already open with a comment describing
what they do and why.

## `docs/features/*.md`

Open with a worked example — the thing actually happening, concretely —
then explain it. Not the other way around.

## What this does not ask for

Never restructure code to make it easier to document. This is a
comments-and-tests instruction, not a refactor. If a function is too
tangled to produce a true example without first changing its shape,
that's a separate, flagged decision — not something to fold into a
documentation pass.
