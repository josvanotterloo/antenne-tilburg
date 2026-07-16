# Instruction: CI (GitHub Actions)

`.github/workflows/ci.yml` runs on **every push to any branch** and on
**pull requests targeting `master`**: checkout → Node 20 → `npm ci` →
`prisma generate` → `tsc --noEmit` → ESLint → enable `pg_trgm` →
`prisma migrate deploy` → full test suite (`scripts/run-tests.sh`, the same
script the run-tests skill uses).

A `postgres:16` service container backs the migration step
(user `test` / password `test` / db `antenne_tilburg_test`, health-checked,
port 5432).

CI is the final verification gate. Claude Code runs tests during TDD cycles
only — see `docs/instructions/branching.md` (close-out) and `CLAUDE.md`
(## Testing).

## Required GitHub secrets

Settings → Secrets and variables → Actions → New repository secret:

| Secret | Value for CI |
|---|---|
| `DATABASE_URL` | `postgresql://test:test@localhost:5432/antenne_tilburg_test` |
| `NEXTAUTH_SECRET` | any random string (e.g. `openssl rand -base64 32`) |
| `NEXTAUTH_URL` | `http://localhost:3000` |
| `EMAIL_ENCRYPTION_KEY` | a valid 32-byte hex key: `openssl rand -hex 32` |

These are throwaway CI values — they must not be production credentials.
The `DATABASE_URL` points at the workflow's own service container.

## Branch protection on master

Settings → Branches → Add branch protection rule:

1. **Branch name pattern:** `master`
2. Enable **Require status checks to pass before merging** and select the
   `ci` check (it appears in the list after the workflow has run at least
   once).
3. Optionally enable **Require branches to be up to date before merging**.
4. **Do not allow bypassing the above settings** — leave bypass disabled
   except for admins ("Allow specified actors to bypass" stays empty;
   admins can still force through via "Include administrators" left
   unchecked).

With protection on, the fast-forward merge flow in `branching.md` keeps
working locally, but a red CI on the branch blocks the push from being
accepted as the new master state via PRs. For direct pushes (the current
solo workflow), CI still runs on every push and flags breakage immediately.
