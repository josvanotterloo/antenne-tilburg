# Instruction: Branching

Follow these rules for all new work in this project.

## Before Starting

Apply karpathy-guidelines before writing any code:
- State your interpretation of the task explicitly
- Flag any ambiguities before proceeding
- Commit to the simplest implementation that meets the goal
- Define what done looks like before starting

## Rules

- The default working branch is `master`.
- Always create a feature branch before starting any new work.
- Branch naming: `<prefix>/<short-description>` (kebab-case), where prefix is
  one of:
  - `feature/` — new functionality
  - `fix/` — bug fixes
  - `chore/` — maintenance, tooling, dependency updates
  - `docs/` — documentation-only changes
- Never commit directly to the default branch.
- Before merging:
  - CI is green (GitHub Actions runs the full suite on every push — see
    `docs/instructions/ci.md`). Claude Code runs tests during TDD cycles only,
    not as a separate pre-merge verification step.
  - Lint / architecture checks clean (if the project configures them)
  - `/code-review` has been run (mandatory — see the close-out checklist) and all
    Medium+ findings are fixed
- Merge strategy: fast-forward (`git merge feature/<name>`)
- Delete the branch after merging.
- Push the branch to the remote before merging if work spans multiple sessions.

## Commit types

Commit types: `feat` (new feature), `fix` (bug fix), `refactor` (no behavior
change), `docs` (documentation), `test` (tests only), `chore` (tooling/
config), `perf` (performance), `ci` (CI pipeline changes). Format: `type:
description` — e.g. `feat: add restock badge to stock pages`.

## Planning

For multi-session implementations: write the plan to `docs/superpowers/plans/` as a
markdown file in addition to creating native tasks. Native tasks don't survive session
boundaries — the file does.

## Close-out checklist

Every feature branch must complete these steps before the session ends:

1. **STOP. Type /code-review in the prompt bar now. Wait for it to
   complete. Fix all Medium+ findings. Only then continue the close-out.**
2. **Run `/code-review` when the change warrants it** — see `CLAUDE.md`
   (## When to run /code-review) for exactly which changes require it and
   which can rely on CI instead. When it applies, run it after the tests
   pass and before merging (step 4). **All Medium+ findings must be fixed
   before merging** — never merge with an open Medium or higher finding. (Lower-
   severity findings are fixed at your discretion.)
3. For frontend changes, do a visual consistency check: open the app and compare any
   states that must stay in sync (e.g. before/after an action, empty/filled, mobile/
   desktop) side by side before merging.
4. Merge the branch to the default branch and delete the feature branch
5. Push to the remote
6. Create `docs/features/NNN-<feature-name>.md` (if you keep feature docs)
7. Fill in `docs/sessions/YYYY-MM-DD.md` using the session log template
8. Add a row to `tasks/lessons.md` for any new mistake or pitfall discovered
   during the session
9. Update any test-count baseline referenced in `tasks/todo.md`
10. Run the project's deterministic checks (lint, any architecture check).
    CI handles final test verification on every push — don't re-run the suite
    locally as a close-out step. Reserve AI review for the parts a script can't
    decide — it saves tokens.
11. Commit and push docs changes

## Verification shortcuts

Use `/goal` to run autonomous verification loops instead of manually checking after
each fix:

- After fixing failing tests:
  `/goal all tests pass`
- After a refactor:
  `/goal lint reports zero errors and all tests pass`

`/goal` keeps the agent working until the condition is met — use it instead of manually
running the test command and fixing one error at a time.
