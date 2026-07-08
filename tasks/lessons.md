# Lessons

Permanent mistake memory. Add a row after any correction from the user, with the
date, the mistake, and the rule it produces.

The seed rows below are general Claude Code / environment lessons carried over from a
prior project — they apply to any repo worked on with this harness. Add project-specific
lessons beneath them as they come up.

## Lessons

| Date | Mistake | Rule | Status |
|---|---|---|---|
| 2026-06-11 | `chmod +x` fails in the Claude Code sandbox (Operation not permitted) | Set the executable bit via `git update-index --chmod=+x` instead; the working-tree copy stays 644 until re-checkout or a manual chmod outside the sandbox | Active |
| 2026-06-17 | Running `git add <file>` AFTER `git update-index --chmod=+x <file>` re-stages it at the working-tree mode (644), silently dropping the exec bit | Stage content first, THEN `git update-index --chmod=+x`, then commit with no further `git add`. Verify with `git ls-files -s` (expect `100755`). Extends 2026-06-11 | Active |
| 2026-06-16 | `rm` / `mv` blocked in the sandbox for some paths | Delete or move temp files via Node `fs` (`unlinkSync` etc.) when the shell command is blocked | Active |
| 2026-04-22b | `settings.local.json` (Claude Code local permissions) showed up in `git diff` — not gitignored | Keep Claude Code local files (`settings.local.json`) in `.gitignore` | Active |
| 2026-05-04 | A feature branch had no commits when the session resumed after context compaction — work happened in the wrong context | When resuming after compaction, verify the feature branch has commits before continuing | Active |
| 2026-06-18 | A plugin was installed but its skills went unused for days while project docs covered the same ground | Audit plugin/skill usage periodically; uninstall plugins whose skills go unused and overlap project docs | Active |
| 2026-04-22 | A doc referenced a script at a path where it didn't exist — the step was skipped silently | Don't reference scripts or paths in docs that don't exist at that path; verify the path or fix the doc | Active |
| 2026-06-30 | New GitHub repos need `gh auth setup-git` to wire the credential helper — even if `gh` is already authenticated, `git push` fails with "Device not configured" until this runs. | Run `gh auth setup-git` once after cloning or creating any new repo in this environment | Active |
| 2026-07-03 | After deleting an App Router route, `tsc --noEmit` reports phantom `Cannot find module '.../page.js'` errors from stale `.next/types` / `.next/dev/types` validator files | After removing routes, `rm -rf .next` and rebuild before trusting typecheck; the stale generated types are not source errors | Active |
| 2026-07-03 | Piping lint through `\| tail`/`\| grep` makes `$?`/`PIPESTATUS` report the pipe tail's exit, masking a non-zero eslint/tsc exit (a real lint error looked like exit 0) | Capture the real exit code: run `npm run lint >/dev/null 2>&1; echo $?` (or check `${PIPESTATUS[0]}`), don't trust the exit code after a pipe | Active |
| 2026-07-04 | Inline `node -e "...db.$disconnect()..."` in a DOUBLE-quoted bash string crashed repeatedly — bash expanded `$disconnect` (and other `$word`) to empty before node saw it | Use SINGLE-quoted bash strings for `node -e` (or a temp `.mjs` file); run node from the project root so bare `@prisma/client` imports resolve | Active |
| 2026-07-04b | Opened the design-direction interview with large multi-question AskUserQuestion batteries; the user rejected them twice, preferring a reference site + a one-line directive | Gather design/product direction from references and context first, then present a concrete draft to react to; reserve AskUserQuestion for a single genuinely-blocking decision, not a survey | Active |
| 2026-07-08 | `prisma migrate dev` regenerates a broken migration (drops the `product_*_trgm_idx` indexes + `ALTER COLUMN search_vector DROP DEFAULT`, which fails P3018 on a GENERATED column) because the `search_vector` tsvector generated column + pg_trgm indexes live in raw SQL and can't be modeled in `schema.prisma` | For any new migration, use `prisma migrate dev --create-only` and delete the auto-generated Product `search_vector` / trigram-index drift lines before applying (hand-write the migration, as the newsletter opt-in one was). See `docs/features/fuzzy-search.md` | Active |
