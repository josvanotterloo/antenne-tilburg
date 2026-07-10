# Session Log — 2026-07-09/10 (Phase 3: full-codebase review fixes)

## What was built
- `feature/code-review-fixes`: fixes for the whole-codebase review
  (`docs/security/code-review-2026-07-09.md`) — 1 High, 5 Medium, 5 Low, all
  TDD. 390 tests (24 new).
- Headline: unsubscribe made prefetch-safe (GET→confirm page, POST→delete);
  products P2025 handling; newsletter email URL-underscore corruption fixed;
  composer duplicate-send lock; CI + pre-commit now typecheck.

## What worked
- 4 parallel slice reviewers over the whole tree; heavy convergence let me
  adjudicate severity confidently and down-rate weak "Mediums" with reasons.
- Live end-to-end verification of the unsubscribe change caught that my first
  check ran against a STALE `next build` (old GET-deletes code) — rebuilt and
  re-verified; restored the dev test-subscribers afterward.

## What drifted from intent
- `npm run start` served a stale build (predating the unsubscribe change) →
  first live check was invalid and deleted a dev row. Lesson added.
- Editing `lib/email/render.ts` sentinels: the Edit tool couldn't match lines
  containing private-use codepoints; resolved by rewriting via Write and
  confirming the bytes with hexdump.

## Signal
- [x] Failure: added a lessons.md row — always `next build` before
      `next start` when verifying a code change, or the run tests stale code.
- [ ] None

## Friction points
- Verifying against `next start` without rebuilding is a silent trap; the
  /run or /verify flow should rebuild first.

## Updates made
- docs/security/code-review-2026-07-09.md (report), session log, tasks/todo.md
  (baseline 390 + review status), tasks/lessons.md (stale-build row).
