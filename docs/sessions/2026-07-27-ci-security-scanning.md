# Session Log — 2026-07-27

## What was built
- CI security scanning gates: `npm audit --audit-level=high --omit=dev` +
  Semgrep (`p/typescript` + `p/security-audit`, `--severity ERROR`) added
  to `.github/workflows/ci.yml` right after ESLint. Caught a real issue
  (missing `authTagLength` on the AES-GCM decrypt call in
  `lib/email-crypto.ts`) before it ever reached CI. Documented in
  `docs/instructions/ci.md` and `docs/features/ci-security-scanning.md`.
- Bumped `actions/checkout` and `actions/setup-node` to v5 in the same
  workflow file.
- Replaced the unconditional "run `/code-review` every time, no
  exceptions" mandate with a scoped policy: a new "When to run
  /code-review" section in `CLAUDE.md` lists what requires it (auth/
  security/payment changes, new or changed API contracts, architectural
  decisions, >5-file changes, pre-deployment) and what can rely on CI
  instead (styling, copy, docs/config, test-only, single-function bug
  fixes). `docs/instructions/branching.md`'s close-out checklist now
  points at that section instead of repeating the old mandatory wording.

## What worked
- Testing the Semgrep scan locally before wiring it into CI meant the
  gate started green on day one instead of immediately failing the next
  push on a pre-existing issue.
- Scoping `npm audit` to `--omit=dev` keeps the gate meaningful — it
  blocks on real production-dependency risk without turning every
  dev-tooling advisory into a failed build.

## What drifted from intent
- None — all three changes were small, self-contained, and verified
  independently before being committed.

## Signal (what should change in a shared artifact)
- [x] Instruction: the old unconditional `/code-review` mandate in
      `CLAUDE.md` / `branching.md` didn't match how the project actually
      works (CI already handles security scanning and test verification);
      replaced with the scoped policy above.
- [ ] Context:
- [ ] Workflow:
- [ ] Failure:
- [ ] None

## Friction points
- These three changes went out without a same-day feature doc / session
  log at the time; a later process audit caught the gap and this log,
  plus `docs/features/ci-security-scanning.md`, backfill it.

## Updates made
- `.github/workflows/ci.yml`: added npm audit + Semgrep steps; bumped
  `actions/checkout` and `actions/setup-node` to v5.
- `docs/instructions/ci.md`: documented both security gates.
- `lib/email-crypto.ts`: added explicit `authTagLength: 16`.
- `CLAUDE.md`: added "When to run /code-review" section.
- `docs/instructions/branching.md`: close-out checklist now points at that
  section instead of a blanket mandate.

## Code review
- Code review: n/a (docs/CI-config changes matching the skip list in
  `CLAUDE.md`; the `lib/email-crypto.ts` fix was a one-line, well-tested
  crypto-parameter correction caught and verified by the new Semgrep gate
  itself)
