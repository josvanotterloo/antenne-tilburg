# Project Template

A reusable Claude Code harness — the process scaffolding stripped of any one
project's domain code. Copy this directory to start a new project:

```sh
cp -R ~/Documents/projects/_project-template ~/Documents/projects/<new-project>
```

Then `chmod +x .claude/skills/run-tests/scripts/run-tests.sh` (the executable bit
does not survive the sandbox) and fill in the bracketed placeholders.

## What's included

| Path | Purpose |
|---|---|
| `CLAUDE.md` | Project instructions — Autonomy + Prompting Tips, wired to the docs below |
| `docs/instructions/branching.md` | Feature-branch rules + close-out checklist |
| `docs/instructions/generate-route.md` | TDD discipline for generating a new module |
| `docs/instructions/interrogate.md` | Interrogatory pattern for design/planning work |
| `docs/session-log-template.md` | Per-session retro template |
| `tasks/todo.md` | Work queue (Active / Backlog / Done) — starts empty |
| `tasks/lessons.md` | Mistake memory — seeded with general harness lessons only |
| `.claude/skills/run-tests/` | "Always run tests via the script" skill |
| `.github/workflows/ci.yml` | Generic install + test + lint CI |
| `.gitignore` | Minimal — includes Claude Code local files |

## Decisions baked in (change if you disagree)

- **Default branch is `main`.** The source project used `master` for historical
  reasons specific to that repo; `main` is the modern `git init` / GitHub default and
  avoids a rename step. To switch back, change "main" in `branching.md` and `ci.yml`.
- **CI assumes a single npm package** (`npm install` / `npm test` / `npm run lint`).
  For a monorepo/workspaces layout, extend the `ci.yml` and `run-tests.sh` per workspace
  (a comment in each marks where).
- **`generate-route.md` is generic.** The original was Express + Duffel + dependency-
  cruiser specific; this keeps the reusable discipline (TDD order, validate-at-boundary,
  run arch check) and leaves the project-specific rules as placeholders.

## Not included (project-specific outputs, generate per project)

Backend/frontend code, `DESIGN.md` / `PRODUCT.md` (outputs of `/impeccable init`),
feature docs, and any vendor-specific docs.
