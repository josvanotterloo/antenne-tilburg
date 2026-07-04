# Session Log — 2026-07-04 (public Newsletter)

## What was built
- `lib/newsletter-input` validator, public `POST /api/newsletter`, `NewsletterForm`
  client component, and the `/newsletter` page.

## What worked
- TDD on the validator + route made the duplicate-email decision explicit (P2002 →
  idempotent success, no enumeration) and covered the 400/201/500 paths.
- Live end-to-end test (fill → submit → DB row → cleanup) confirmed the whole path,
  which unit tests can't (real Prisma create + unique constraint).

## What drifted from intent
- None. Flagged two deliberate MVP gaps (no rate limiting, no double opt-in) in the
  feature doc rather than building them now.

## Signal (what should change in a shared artifact)
- [ ] Failure: public write endpoints need a rate-limit story; none exists yet.

## Updates made
- validator (+test), API route (+test), form (+test), `/newsletter` page, feature doc,
  this log.
