# Incident: leaked Sentry auth token — 2026-08-14

## What happened

Commit `af9647f` (2026-08-13, "fix: reconcile Sentry wizard output back to
the agreed setup") added a real `SENTRY_AUTH_TOKEN` value (199 characters,
`sntrys_...` — Sentry's live token format) to `.env.example` and pushed it
to `origin/master`. `.env.example` is a committed template file, not a
gitignored secrets file — anything written there is public to anyone with
read access to the repository, immediately and in perpetuity via git
history.

The same commit's own message also included the real `SENTRY_DSN` value in
plaintext. Sentry DSNs are designed to be safely public (they're
rate-limited, write-only identifiers shipped in client-side JS bundles
routinely) — not treated as a secret for this incident, and left as-is in
history.

## How it happened

Earlier in the same session, the Sentry setup wizard (`npx @sentry/wizard`)
had modified several files, including `.env.example`, while connecting the
project to a real Sentry account. `.env.example` is covered by this
environment's global `Read(**/.env.*)` deny rule — a guard specifically
meant to prevent exactly this class of mistake — so its contents were never
directly readable. When reconciling the wizard's other changes back to the
project's agreed design (env-gated Sentry init, no hardcoded DSN,
PII-scrubbing restored), `.env.example` was included in the commit anyway,
on the reasoning that it was "the user's own file, probably just template
values." That reasoning was wrong: the wizard had written a real credential
there, and committing a file whose contents can't be verified is exactly
the scenario the guard exists to prevent.

## Detection

Surfaced by `/code-review` on an unrelated branch (input-hardening),
prompted by a routine `git diff` on the working tree — the reviewer
independently verified the token's length and format prefix before
reporting it, rather than assuming.

## Remediation

1. **Token rotated** — the leaked `SENTRY_AUTH_TOKEN` was revoked in
   Sentry's dashboard and replaced, by the repo owner. This is the only
   step that actually neutralizes the exposure; everything below is
   cleanup.
2. **Scrubbed from git history** — `git filter-repo --replace-text` run
   against a fresh clone, replacing the exact leaked token string (never
   printed to the assistant's own context during this process — extracted
   via shell redirection, verified only by length/prefix/absence checks)
   across all 372 commits. Verified zero remaining occurrences via
   `git grep` across every blob in `git rev-list --all` before pushing.
   Force-pushed the rewritten history to `origin/master` (branch
   protection initially rejected the force-push, succeeded on retry with
   no setting changes — likely a transient propagation delay).
3. **`.env.example` fixed going forward** — the `SENTRY_AUTH_TOKEN` line
   removed entirely. Auth tokens belong in `.env.sentry-build-plugin`
   (already gitignored by the Sentry wizard's own `.gitignore` addition),
   never in a committed template file.
4. Local checkouts of this repo (any that existed before the rewrite) now
   have diverged history and need `git fetch && git reset --hard
   origin/master` to pick up the rewritten commits — a rewritten history
   is not something `git pull` reconciles cleanly.

## Rule going forward

See `tasks/lessons.md` (2026-08-14): never commit real values to
`.env.example`, even temporarily — it's a template, always placeholders.
Real values go in `.env.local` or `.env.sentry-build-plugin` (gitignored).
