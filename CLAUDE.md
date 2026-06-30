# Project Instructions

> Template harness. Replace bracketed placeholders, adjust the Setup line, and
> delete this note once the project is initialized.

## Setup
To set up: [run `./init.sh` / `npm install` — adjust per project].

## Current Tasks
See `tasks/todo.md` — active work, backlog, and done items.

## Permanent Lessons
See `tasks/lessons.md` — mistake memory. After any correction from the user, add a
row to `tasks/lessons.md` immediately with the date, mistake, and rule.

## Instructions
- Branching rules: see `docs/instructions/branching.md`
- Generate a new module/route: see `docs/instructions/generate-route.md`
- Interrogate before generating: see `docs/instructions/interrogate.md`
- Session log template: see `docs/session-log-template.md`

## Testing
Run tests: see `.claude/skills/run-tests/SKILL.md` — always use the run-tests skill,
never construct custom test commands.

## Autonomy

### Long-running tasks
For any task expected to take more than 30 minutes or touch more than 5 files:
- Commit after every logical unit of work completes successfully
- Each commit must leave the codebase in a passing state (tests green, no broken imports)
- Use descriptive commit messages: "fix: resolve lint errors in App.jsx (12/69)"
- Never leave uncommitted changes when stopping — partial progress in git is
  recoverable, partial progress in the working tree is not

This ensures session-limit interruptions preserve progress rather than losing it.

## Prompting Tips
For complex or ambiguous tasks, prefix your prompt with `ultrathink` to trigger
high-effort reasoning before starting.
