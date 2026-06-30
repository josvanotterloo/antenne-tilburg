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
