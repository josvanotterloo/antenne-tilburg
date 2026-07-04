# Public newsletter signup

**Status:** branch `feature/public-newsletter` — merged to `master` (2026-07-04).

## Summary
`/newsletter` — a public signup form (name + email) that creates a
`NewsletterSubscriber`. First public write path on the site.

## What's in place
- **`lib/newsletter-input.ts`:** `parseNewsletterInput` — name required (trimmed,
  ≤100 chars), email validated with the shared regex and normalised (trim +
  lowercase). Pure + tested.
- **`POST /api/newsletter`:** public (no auth). Validates → `db.newsletterSubscriber.create`.
  A duplicate email (`P2002`) is treated as success (`{ ok, alreadySubscribed }`) —
  idempotent and non-enumerating; unexpected errors are logged and return 500.
- **`components/NewsletterForm.tsx`:** client form with submitting / success / error
  states, on-brand inputs (black field, hairline border, signal focus) and a primary
  Sign-up button. Server validation drives the error message.
- **`/newsletter`:** hosts the form under a short intro.

## Tests & verification
- **13 tests** (235 total green): validator (valid/normalise, missing name, bad email,
  null body, long name); route (400 invalid, 201 create with normalised data,
  duplicate→already-subscribed, 500 on unexpected); form (renders fields, posts +
  confirms on success, shows server error). `tsc` + lint clean.
- **Live end-to-end:** submitted a test signup → row created in Postgres → confirmation
  shown; verified the row and cleaned it up.

## Known gaps (MVP, deliberate)
- **No rate limiting** on the public endpoint yet — a spam vector; add a limiter when
  one is introduced project-wide.
- **No double opt-in / email confirmation** — subscribers are added directly. Consider
  confirmation for GDPR/anti-abuse before real sends.
