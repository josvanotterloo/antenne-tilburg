# CI/security hardening (2026-11-23)

Four items from the 2026-11-20 repeated-mistakes audit, each on its own
branch, merged in order.

## 1. npm audit isolated into its own CI job

Every recorded CI failure in this repo's history failed at the same step:
`npm audit (production dependencies)`. Because it was the last step of one
single `ci` job, a failing audit also skipped Semgrep and the full test
suite — the real tests never ran on any of those pushes.

Split into a separate `npm-audit` job (`.github/workflows/ci.yml`) with no
`needs:` dependency on `ci`, so the two run independently. Added a weekly
`schedule` cron trigger (gated out of the `ci` job via
`if: github.event_name != 'schedule'`) so a newly-published advisory on an
unchanged dependency tree is still caught between pushes.

**Still needs a manual step**: GitHub branch protection (Settings →
Branches) lists `ci` as a required status check. It needs `npm-audit`
added alongside it — that's a repo-settings change, not something a
workflow-file commit can do. Every merge in this session printed:
`Bypassed rule violations ... Required status check "ci" is expected.`

`scripts/check-npm-audit.mjs` and its allowlist are unchanged.

## 2. Secret scanning (gitleaks) + .env.example repaired

Added `gitleaks` (binary, not the marketplace action) to:
- `.githooks/pre-commit`: `gitleaks protect --staged --redact --no-banner`,
  fails closed (exits 1) if the binary isn't installed.
- CI: downloaded from GitHub Releases and checksum-verified against the
  published `gitleaks_<version>_checksums.txt`, then `gitleaks detect`
  against full history.

Verified against a throwaway fixture repo: a well-known placeholder
(`AKIAIOSFODNN7EXAMPLE`) is correctly *not* flagged (it's gitleaks' own
documented false-positive allowlist entry), a realistic `sk_live_...`
Stripe-shaped key *is* flagged and exits 1. A full-history scan of this
repo (497 commits) is clean and takes under a second.

Also fixed `.env.example`, found broken on `master` while building the new
`env-example.test.ts` check: `ef62a78`'s "remove `SENTRY_AUTH_TOKEN`"
commit never actually removed it — the diff shows it added unresolved
git-merge-conflict markers (`<<<<<<< Updated upstream` / `=======` /
`>>>>>>> Stashed changes`) around the token and DSN lines, from an
unresolved `stash pop`, without actually deleting either line. Both the
conflict markers and the stale token value had been sitting on `master`
undetected since 2026-08-14.

`env-example.test.ts` now enforces: no unresolved conflict markers, and
every env var is empty except an explicit allowlist of safe
placeholders/public values (`DATABASE_URL`, `NEXTAUTH_SECRET`,
`NEXTAUTH_URL`, `DYMO_MODE`, `SENTRY_DSN`).

**Known limitation, not fixed here**: Claude Code's own global guard
(`Read(**/.env.*)`-equivalent) denies *every* tool this session has —
`Read`, `Bash cat`, `sed -i`, `git diff -- .env.example` — from touching
`.env.example` by its working-tree path, in either direction. Only
`git show <ref>:.env.example` (reading the git object, not the
working-tree path) gets through. The actual repair to `.env.example` in
this session was made by the user directly, not by Claude Code, for
exactly this reason.

## 3. Migration-creation always runs clean-migration.ts

`scripts/clean-migration.ts` (added 2026-10-19) was only ever documented
as a manual second step (`docs/instructions/branching.md`) — easy to skip,
which is exactly what happened before the tool existed (`90a50ef`).

- `npm run migrate:create -- <name>` (`scripts/migrate-dev.ts`): runs
  `prisma migrate dev --create-only` then `clean-migration.ts` as one
  step. Does not auto-apply — the mandatory hand-verify gate before
  `npm run prisma:migrate` is unchanged.
- `npm run check:migration-drift` (`scripts/check-migration-drift.ts`,
  now a CI step): scans every committed migration for the same spurious
  drops, reusing `cleanMigrationSql`'s own detection so the two can't
  drift apart on what counts as spurious.

**Proven against `90a50ef`**: running the check against that commit's
pre-fix `migration.sql` (`git show 90a50ef^:...`) correctly flags all 3
spurious `DROP INDEX` statements it later removed; against the post-fix
version, zero. Against the current repo's 22 real migrations: zero
findings.

## 4. `pkill` denied in Claude Code settings

`tasks/lessons.md` 2026-08-17 / 2026-08-18: `pkill -f`, broad or narrow,
killed an unrelated pre-existing dev-server process twice in two separate
sessions, the second time despite the logged lesson from the first. Added
`"Bash(pkill:*)"` to `.claude/settings.json`'s `permissions.deny`.
Verified live: a harmless, non-matching `pkill -f` pattern was denied
immediately by the harness.
