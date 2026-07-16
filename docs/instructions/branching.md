# Instruction: Branching

Follow these rules for all new work in this project.

## Before Starting

Apply karpathy-guidelines before writing any code:
- State your interpretation of the task explicitly
- Flag any ambiguities before proceeding
- Commit to the simplest implementation that meets the goal
- Define what done looks like before starting

## Rules

- The default working branch is `main`.  <!-- change to `master` if you prefer -->
- Always create a feature branch before starting any new work.
- Branch naming: `feature/<short-description>` (kebab-case)
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

## Planning

For multi-session implementations: write the plan to `docs/superpowers/plans/` as a
markdown file in addition to creating native tasks. Native tasks don't survive session
boundaries — the file does.

## Close-out checklist

Every feature branch must complete these steps before the session ends:

1. **Run `/code-review` — mandatory, every time, no exceptions.** Run it after the
   tests pass and before merging (step 3). **All Medium+ findings must be fixed
   before merging** — never merge with an open Medium or higher finding. (Lower-
   severity findings are fixed at your discretion.)
2. For frontend changes, do a visual consistency check: open the app and compare any
   states that must stay in sync (e.g. before/after an action, empty/filled, mobile/
   desktop) side by side before merging.
3. Merge the branch to the default branch and delete the feature branch
4. Push to the remote
5. Create `docs/features/NNN-<feature-name>.md` (if you keep feature docs)
6. Fill in `docs/sessions/YYYY-MM-DD.md` using the session log template
7. Update any test-count baseline referenced in `CLAUDE.md`
8. Run the project's deterministic checks (lint, any architecture check).
   CI handles final test verification on every push — don't re-run the suite
   locally as a close-out step. Reserve AI review for the parts a script can't
   decide — it saves tokens.
9. Commit and push docs changes

## Verification shortcuts

Use `/goal` to run autonomous verification loops instead of manually checking after
each fix:

- After fixing failing tests:
  `/goal all tests pass`
- After a refactor:
  `/goal lint reports zero errors and all tests pass`

`/goal` keeps the agent working until the condition is met — use it instead of manually
running the test command and fixing one error at a time.
