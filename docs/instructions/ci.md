# Instruction: CI (GitHub Actions)

`.github/workflows/ci.yml` runs on **every push to any branch** and on
**pull requests targeting `master`**: checkout → Node 20 → `npm ci` →
`prisma generate` → `tsc --noEmit` → ESLint → `npm audit` (production deps)
→ Semgrep security scan → enable `pg_trgm` → `prisma migrate deploy` →
full test suite (`scripts/run-tests.sh`, the same script the run-tests
skill uses).

## Security scanning

Two gates run right after ESLint, before anything touches the database:

- **`npm audit --audit-level=high --omit=dev`** — fails the build on any
  `high` or `critical` vulnerability in **production** dependencies.
  `--omit=dev` means dev-only tooling vulnerabilities never block CI —
  those are triaged separately and, when accepted as non-exploitable
  (e.g. a `devDependency` that never runs against attacker-controlled
  input), tracked as a follow-up in `tasks/todo.md`'s Security section
  rather than gating every push. See
  `docs/features/security-dependency-updates.md` for the reasoning behind
  that split and the current accepted-risk item.

- **Semgrep** (`p/typescript` + `p/security-audit` rulesets, `--severity
  ERROR --error`) — a static analysis scan for real code-level security
  bugs `npm audit` can't see, since `npm audit` only checks *known
  vulnerable dependency versions*, not bugs in this repo's own code.
  Catches things like missing crypto parameters, injection-prone
  patterns, and other rule-matched anti-patterns. Runs via the plain
  `semgrep scan` CLI (installed with `pip` in the step), not the
  `semgrep/semgrep-action` GitHub Action — that action is deprecated
  (its README is now just a pointer to native Semgrep support). Free and
  token-free: no `SEMGREP_APP_TOKEN` or Semgrep account is needed for
  this ruleset-based, non-platform invocation.
  `--severity ERROR` scopes the gate to blocking findings only — `WARNING`
  and `INFO` findings are excluded so the gate stays actionable instead of
  noisy. This step found and fixed a real issue during rollout: a missing
  `authTagLength` on the AES-GCM decrypt call in `lib/email-crypto.ts`
  (`javascript.node-crypto.security.gcm-no-tag-length`).

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
