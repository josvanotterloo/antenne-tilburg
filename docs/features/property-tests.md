# fast-check property tests

A sixth testing layer: [fast-check](https://fast-check.dev/) property tests
alongside the existing example-based unit tests, in `describe("property", ...)`
blocks in `lib/catalog.test.ts`, `lib/email/render.test.ts`, and
`lib/token.test.ts`.

## Running

```
npm run test:property   # vitest run --reporter=verbose -t property
```

Filters by test name, not file path — the properties live inside the
existing test files rather than separate `*.property.test.ts` files, so a
path-based filter (`vitest run features` style) wouldn't match anything.
They also run automatically as part of `npm test` / CI, since they're
ordinary tests in ordinary `*.test.ts` files.

## Two corrections to the original spec

Both properties, as originally worded, are provably false against the real
implementations — verified by tracing the code, not assumed:

- **`buildCatalogOrderBy` does not always return an array.** Only
  `sort === "artist"` does (`lib/catalog.ts:95-96` — sorts by
  `primaryArtistName` since the artist-entity migration, not a scalar
  `artist` column); `"label"`, `"date"`, and any unrecognized sort value
  return a single plain object. The real property: the result is always a
  non-empty array *or* non-empty object.
- **`markdownToHtml` does not always return a non-empty string.**
  Blank/whitespace-only input (`""`, `"   "`) legitimately produces `""` —
  the block-parsing loop skips blank lines and pushes nothing. The real
  property: output is non-empty for any input containing at least one
  non-whitespace character, checked separately from an unconditional
  "never throws for any string" property.

## fast-check found a real bug — in the test, not the production code

The escaped-character property (`\*`, `\_`, `\\` always survive as their
literal character) originally wrapped the escape token in arbitrary
`fc.string()` prefix/suffix text. fast-check's shrinker found two distinct
ways that surrounding text could corrupt the property's own setup rather
than testing anything real about `markdownToHtml`:

1. A prefix ending in `\` merges with the escaped token's own leading `\`,
   changing which pair the `ESCAPED_CHAR` regex matches and leaving the
   intended literal character loose for an unrelated emphasis regex to
   swallow.
2. A prefix of `` ``` `` turns the whole line into an unclosed fenced-code
   block opener, discarding everything after it on the same line —
   including the escaped token the test meant to check.

Both were closed the same way: surrounding text is now generated from a
positive, markdown-inert character set (letters, digits, spaces) instead
of a growing list of excluded special characters. This is simpler (no
reject-and-retry filtering) and, more importantly, closes the whole class
of "some markdown-significant character sneaks into the 'plain' prefix/
suffix" bug rather than each instance fast-check happens to find.

This class of bug — a property test failing not because production code
is wrong, but because the test's own input construction lets unrelated
generated characters interact with the specific case under test — is
worth watching for whenever combining multiple arbitraries with string
concatenation.

## Determinism note

fast-check runs unseeded by default: each run samples different random
inputs (default 100 per property). This is what caught the bug above —
but it also means a genuinely rare edge case in production code could,
in principle, go unsampled on any given CI run. No fixed seed was added;
that's a real tradeoff (reproducibility vs. exploration breadth) worth a
deliberate decision if it ever causes a confusing "flaky" CI run, rather
than something to default silently either way.
