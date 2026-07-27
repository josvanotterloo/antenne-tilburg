# Session Log — 2026-07-27

## What was built
- Fixed all critical and moderate `npm audit` findings, plus the
  high-severity `next`/`postcss`/`sharp` advisories.
- `docs/features/security-dependency-updates.md`, plus a tracked
  follow-up in `tasks/todo.md` for the one deliberately-unfixed item.

## What worked
- Testing the risky fix directly instead of assuming: `npm audit fix
  --force` proposed downgrading `next` to `9.3.3` (nonsensical resolver
  path — ignored it), and forcing `brace-expansion` to its patched
  version via `overrides` looked clean on paper but actually broke lint
  (`expand is not a function`) the moment I ran it. Both would have been
  wrong calls made confidently from audit output alone.
- `/code-review` caught real scope creep I'd missed: I'd bumped `eslint`
  and `eslint-config-next` while chasing the (ultimately abandoned)
  brace-expansion fix, and left them bumped after reverting that attempt.
  Reverting them and re-running `npm audit` confirmed the vulnerability
  count was byte-for-byte identical either way — they were never part of
  the actual fix.

## What drifted from intent
- Accidentally ran `git stash` mid-review while trying to test a revert
  in a scratch way, which briefly reverted staged work. Caught and
  restored immediately via `git stash pop` — no lost work, but the right
  move would have been editing package.json directly (as I did
  afterward) rather than reaching for `git stash` for a quick experiment.

## Signal (what should change in a shared artifact)
- [ ] Context:
- [ ] Instruction:
- [x] Workflow: don't use `git stash` for a quick "let me test reverting
      this" experiment on a branch with staged work — edit the file
      directly (or use a throwaway branch/worktree) so there's no
      moment where staged work is out of the working tree.
- [ ] Failure:
- [ ] None

## Friction points
- Same `/code-review` `disable-model-invocation` restriction as every
  prior session on this project — expected, no action needed.

## Updates made
- `package.json`: `next` 16.2.10→16.2.12, `postcss` ^8.4.47→^8.5.23,
  new `overrides` block (`qs`, `postcss`, `sharp`).
- `package-lock.json`: resolves `next-auth`→5.0.0-beta.32, `@auth/core`
  →0.41.3, `sharp`→0.35.3, `qs`→6.15.3 throughout.
- `docs/features/security-dependency-updates.md`.
- `tasks/todo.md`: brace-expansion re-check follow-up.
