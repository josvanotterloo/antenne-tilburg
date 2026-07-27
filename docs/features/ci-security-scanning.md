# CI security scanning (2026-07-27)

Two gates were added to `.github/workflows/ci.yml`, right after ESLint and
before anything touches the database, so security issues are caught on
every push instead of relying on periodic manual audits.

## `npm audit` (production dependencies)

```
npm audit --audit-level=high --omit=dev
```

Fails the build on any `high` or `critical` vulnerability in **production**
dependencies. `--omit=dev` means dev-only tooling vulnerabilities never
block CI — those are triaged separately and, when accepted as
non-exploitable (e.g. a devDependency that never runs against
attacker-controlled input), tracked as a follow-up in `tasks/todo.md`'s
Security section instead of gating every push. See
`docs/features/security-dependency-updates.md` for the reasoning behind
that split and the currently accepted-risk item (the `brace-expansion`
cascade via the eslint toolchain).

## Semgrep static analysis

```
semgrep scan --config p/typescript --config p/security-audit --severity ERROR --error
```

Static analysis for code-level security bugs `npm audit` can't see —
`npm audit` only checks known vulnerable dependency *versions*, not bugs in
this repo's own code. Catches things like missing crypto parameters,
injection-prone patterns, and other rule-matched anti-patterns.

- Runs via the plain `semgrep scan` CLI (installed with `pip` in the
  workflow step), not the `semgrep/semgrep-action` GitHub Action — that
  Action is deprecated (its README is now just a pointer to native Semgrep
  support).
- Free and token-free: no `SEMGREP_APP_TOKEN` or Semgrep account is needed
  for this ruleset-based, non-platform invocation.
- `--severity ERROR` scopes the gate to blocking findings only — `WARNING`
  and `INFO` findings are excluded so the gate stays actionable instead of
  noisy.

## Real finding caught on rollout

Running the exact scan locally before wiring it up surfaced a real issue:
`lib/email-crypto.ts`'s AES-GCM decrypt call had no explicit
`authTagLength`, so tag-length validation depended on runtime defaults
rather than being pinned
(`javascript.node-crypto.security.gcm-no-tag-length`). Fixed
(`authTagLength: 16`, matching what `encryptEmail` always produces) so the
gate started green instead of immediately failing on a pre-existing issue.

See `docs/instructions/ci.md` for the full CI pipeline and required GitHub
secrets.
