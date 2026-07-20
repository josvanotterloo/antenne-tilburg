# Session Log — 2026-07-21 (newsletter escaped asterisks)

## What was built
- `lib/email/render.ts` had no backslash-escape mechanism at all. `\*`
  (lone) leaked its backslash through untouched; a run like
  `\*\*\*\*\*\*\*\*` got misread by the italic regex as mismatched
  open/close pairs, producing garbled `<em>` tags interleaved with stray
  backslashes instead of eight literal asterisks.
- Added `ESCAPED_CHAR` (`\\`, `\*`, `\_`), stashed via the existing
  sentinel mechanism in `formatEmphasis` — before image/link/bold/italic
  parsing runs, so escaped punctuation is invisible to markdown syntax.
- TDD: read the file byte-for-byte first (the "empty" `STASH_OPEN`/
  `STASH_CLOSE`/`STASH_RE` in editor output are invisible PUA sentinel
  characters, not literally blank — confirmed via `cat -e` before writing
  any code) to understand the existing stash idiom before extending it.
  4 RED tests first (lone escape, 8-asterisk run, escaped bold marker,
  escaped backslash), plus a regression guard for real `*`/`**`/`***`
  that already passed.

## What worked
- My first test draft asserted against the FULL `renderNewsletterEmail`
  output and failed for the wrong reason (that wrapper always emits its
  own footer `<hr>`, regardless of body content) — caught before treating
  it as a real RED signal; switched to testing the exported
  `markdownToHtml` directly, the more precise unit.
- Realized the composer's *browser preview* uses `react-markdown`
  (already spec-compliant, escapes worked fine there) — verifying via the
  Preview button would have proven nothing about the actual bug. Verified
  instead by calling the real `markdownToHtml` function directly against
  the exact repro string from the task, on the actual send-time code path.

## What drifted from intent
- Scoped the fix to the three characters this engine's own emphasis
  regexes interpret (`*`, `_`, `\`), not a general CommonMark-style escape
  set (`#`, `[`, `]`, etc.) — those aren't part of the demonstrated bug.
- Deliberately did NOT change paragraph line-joining (consecutive lines
  within a block still merge with a space) even though the task's
  3-line example depicts stacked output — the stated acceptance
  criterion was specifically about literal asterisks, not layout;
  documented as a known limitation instead of silently expanding scope.

## Signal (what should change in a shared artifact)
- [ ] None.

## Friction points
- None beyond the two self-caught test-design issues above.

## Updates made
- `lib/email/render.ts` (+tests), `docs/features/structured-newsletter.md`
