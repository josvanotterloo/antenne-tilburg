# Session Log — 2026-07-07 (newsletter sending)

## What was built
- Full newsletter send channel: double opt-in signup, confirm + unsubscribe routes,
  admin composer, Resend-backed admin send to confirmed subscribers, dark email
  templates, subscriber status badges + confirmed-only count/export. Brainstorm →
  spec → plan → TDD build in 9 committed units + close-out. 310 tests green.

## What worked
- Spec/plan up front made the TDD loop mechanical: each route/unit had its tests
  written first, one full-suite run per unit, commit green.
- Small isolated units (`lib/token`, `lib/email/*`, per-route handlers) kept each
  commit self-contained and easy to reason about.

## What drifted from intent
- Nothing on requirements. One implementation bug slipped past 305 content-based
  tests: the email `font-family` used double-quoted font names interpolated into a
  double-quoted `style=""` attribute, which broke the attribute and rendered the
  email in serif. The **live visual check** caught it; fixed + regression-tested.

## Signal (what should change in a shared artifact)
- [x] Failure: content-assertion tests can't catch rendered-appearance bugs (fonts,
  layout). For any HTML-email or template work, a live render check is worth keeping
  mandatory — it's the only thing that caught the serif regression here.

## Friction points
- `.env.example` is behind the secrets-file permission (can't Read/Edit), but a bash
  append worked; documented the keys in admin-credentials.md too.
- Prisma `migrate dev` is interactive and refused the non-interactive shell with an
  existing row; hand-wrote the migration (backfill existing → CONFIRMED + token) and
  applied via `migrate deploy`.
- Next 16 refuses a second dev server; reused the running one on :3000. Served email
  HTML samples via a throwaway `python3 -m http.server` (file:// is blocked in the
  browser tool).

## Updates made
- Model + migration; `lib/token`, `lib/email/*`, `lib/newsletter-page`,
  `lib/newsletter-send-input`; signup/confirm/unsubscribe/send routes; composer +
  page + content nav; subscriber page badges/count + export filter; env docs;
  feature doc; this log.
