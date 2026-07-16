# Session Log — 2026-07-16 (CI pipeline)

## What was built
- `.github/workflows/ci.yml`: on every push + PRs to master — Node 20,
  npm ci, prisma generate, tsc, eslint, pg_trgm + migrate deploy against a
  postgres:16 service container, full suite via `scripts/run-tests.sh`.
  **Replaced a stale scaffold workflow that triggered on `main` (default
  branch is `master`) and had therefore never run.**
- `docs/instructions/ci.md`: required secrets + master branch-protection
  setup. Set the four repo secrets via `gh secret set` (throwaway CI
  values; NEXTAUTH_SECRET/EMAIL_ENCRYPTION_KEY generated with openssl).
- `branching.md` + `CLAUDE.md`: CI is the final test gate; Claude Code runs
  tests during TDD only.
- Fix that surfaced on the first run: `prisma.config.ts` called
  `process.loadEnvFile()` unconditionally → ENOENT in CI (no .env). Now
  loads only when the file exists.

## What worked
- First run failed fast and pointed straight at the config; second run
  green end-to-end (run 29501122773, conclusion: success).

## What drifted from intent
- Nothing. Spec said Node 20; note GitHub's runner annotation that Node 20
  actions runtime is deprecated (actions forced onto Node 24) — consider
  bumping `node-version` to 22 at some point.

## Signal (what should change in a shared artifact)
- [x] Instruction: branch protection on master still needs to be enabled by
  hand in GitHub settings (documented in docs/instructions/ci.md) — the CI
  check appears in the picker now that the workflow has run.

## Friction points
- None beyond the .env discovery.

## Updates made
- `.github/workflows/ci.yml`, `docs/instructions/ci.md`, `prisma.config.ts`
- `docs/instructions/branching.md`, `CLAUDE.md`
