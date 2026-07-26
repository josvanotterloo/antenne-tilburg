# Stryker mutation testing on `lib/`'s pure core

A fifth testing layer: [Stryker](https://stryker-mutator.io/) mutates
`lib/`'s pure, framework-free core and re-runs the Vitest suite against each
mutation, checking whether at least one test fails ("kills" the mutant).
Surviving mutants point at behavior the test suite doesn't actually verify.

## Scope

`stryker.config.mjs` mutates exactly the 7 files given in the original
task: `lib/catalog.ts`, `lib/email/render.ts`, `lib/token.ts`,
`lib/authorize.ts`, `lib/blog.ts`, `lib/notice.ts`, `lib/rss.ts`. `app/` and
`components/` are excluded — UI mutation testing is too noisy (a mutant in
JSX rarely has a single, clean behavioral assertion to kill it).

There are other equally pure, framework-free `lib/` files not in this list
(`json-ld.ts`, `structured-data.ts`, `markdown.ts`, `slug.ts`, the
`*-input.ts` validators, etc.) — the scope here matches exactly what was
asked for this pass, not a claim that everything pure is covered. Worth
revisiting if this becomes a standing practice rather than a one-off.

## Running

```
npm run test:mutate   # stryker run
```

Not wired into CI or `scripts/run-tests.sh` — a full run takes ~2 minutes
and isn't a per-push gate. Run it manually after meaningful changes to the
7 scoped files, or periodically to catch drift.

## Baseline run and what it found

The first run scored **74.15% overall**, below the 80% target:

- `lib/rss.ts` had **zero existing tests** — `lib/rss.test.ts` is new,
  covering `productFeed`'s RSS 2.0 structure, XML escaping, and price
  formatting. Verified against a manually-broken `escapeXml` to confirm it
  actually catches regressions.
- `lib/blog.ts` (57.83%) and `lib/email/render.ts` (57.56%) had large gaps:
  fenced code blocks were completely untested in the markdown renderer,
  several regex-driven parsing loops only had "runs to end of input"
  scenarios rather than "stops at the first non-matching line" scenarios,
  and `postExcerpt`'s no-word-boundary and exact-max-length branches were
  never exercised.

After adding tests for these real gaps: **83.08% overall** (`catalog.ts`
90.64%, `notice.ts` 94.44%, `rss.ts` 95.00%, `token.ts` 100%, `authorize.ts`
80.56%, `blog.ts` 79.52%, `email/render.ts` 74.37%).

## A note on `render.ts`'s remaining survivors

`render.ts` sits below 80% individually. Tracing its survivors found a
category that looks like a **Stryker↔Vitest 4 compatibility gap**, not a
real test gap: several surviving mutants replace a `while` loop's
condition with `true`, which — traced by hand — causes the loop to run
past the array bound and throw a `TypeError` inside `markdownToHtml`. That
throw genuinely fails the relevant tests when the mutation is applied
manually (verified directly), but Stryker's `@stryker-mutator/vitest-runner`
reports these specific mutants as "Survived" rather than "Killed" or even
"Timeout." This didn't change when `coverageAnalysis` was switched from
`"perTest"` to `"off"`. Not chased further — it's tooling archaeology, not
a signal that these code paths are actually undertested.

## Test-quality note

One thing the fixing pass corrected during `/code-review`: a couple of new
tests were initially written by reverse-engineering a specific surviving
mutant (e.g. an input of 12 consecutive backslash-escaped asterisks, which
no real author would type, just to force an internal placeholder-index
into double digits). Where that happened, the input was reframed around a
realistic scenario that exercises the same code path — a newsletter
paragraph linking a dozen new arrivals — rather than left as a synthetic
stress test. Mutation testing is a tool for *finding* undertested behavior;
the test that closes the gap should still describe something a real caller
would do.
