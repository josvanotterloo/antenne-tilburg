# Newsletter signup: graceful degradation + retry queue

Previously, if Resend timed out or errored during signup, the user either
saw an error (a real send failure) or a success message that didn't
distinguish "email sent" from "email queued" (a timeout — from the
`fix/external-call-timeouts` session). Neither case gave a way to know
which subscribers never got their confirmation email, or to retry them.

## `confirmEmailSentAt`

`NewsletterSubscriber.confirmEmailSentAt DateTime?` — null until the
confirmation email is successfully sent. A `PENDING` row with this still
null means the signup-time send failed or timed out and is waiting on a
retry. Migration:
`prisma/migrations/20260813120011_add_confirm_email_sent_at/` — hand-trimmed
per `tasks/lessons.md` (2026-07-08/17/29b): `prisma migrate dev
--create-only` re-proposed dropping the hand-written `search_vector`/trigram
indexes unrelated to this change; those lines were removed before applying.

The migration also backfills `confirmEmailSentAt = createdAt` for every
existing `PENDING` row (`/code-review` catch — the initial version left
pre-existing rows null, which would have made the new retry queue blast a
duplicate confirmation email to every already-pending subscriber the first
time an admin ran it). We can't know in hindsight whether an old row's
original send actually succeeded; treating it as sent is the safer of the
two wrong guesses. `CONFIRMED` rows are unaffected either way.

`lib/newsletter-confirm-window.ts` holds the shared `CONFIRM_WINDOW_MS`
(48h) and an `isRetryEligible()` helper, used by three places that must
agree on the same window: the confirm route (rejects an expired token), the
retry endpoint (no point retrying a dead link), and the admin page (only
offers the retry button when it would actually do something — an earlier
version of the button's visibility check had no age cutoff at all, so it
could stay visible for a permanently-stuck row the retry endpoint would
silently skip).

## Unified signup response (`app/api/newsletter/route.ts`)

The `TimeoutError`-specific branch added in the external-call-timeouts
session is gone — **any** `sendEmail` failure (timeout or a real Resend
error) now degrades the same way, since neither can be distinguished from
"might still succeed later" from the caller's side:

- Send succeeds → `confirmEmailSentAt` set, `201
  { ok: true, message: "Check your email to confirm your subscription" }`.
- Send fails (any reason) → row kept as-is (`confirmEmailSentAt` stays
  null), `201 { ok: true, message: "You're on the list — we'll send your
  confirmation email shortly" }`. No error shown to the user, no delete.

This is a deliberate interface change from the previous session's behavior
(a real, non-timeout error used to delete the row and 500). The two tests
asserting that old contract were replaced, not kept — see `tasks/lessons.md`
if you're looking for why they changed.

`components/NewsletterForm.tsx` now reads `message` from the response body
instead of always showing a hardcoded string, so the two outcomes read
differently to the person signing up.

## Retry queue

`POST /api/admin/newsletter/retry-pending` (admin-only) — finds `PENDING`
subscribers with `confirmEmailSentAt: null` and `createdAt` within the last
48 hours (matching the confirm link's own expiry window in
`app/api/newsletter/confirm/route.ts` — no point retrying a send whose link
would already be expired), re-sends the confirmation email to each, and
marks `confirmEmailSentAt` on success. Returns `{ tried, succeeded, failed
}`. Mirrors `app/api/admin/newsletter/send/route.ts`'s guard/preflight/count
pattern (same `assertEmailCryptoConfigured()` preflight, same "log the id,
never the address" rule). Manual trigger only — no cron/scheduled job.

## Admin UI (`/admin/settings/subscribers`)

- `StatusBadge` now distinguishes three states: Confirmed (green), Pending
  with the email already sent (amber, unchanged from before — just waiting
  on the subscriber), and **Pending (no email sent)** (red) — the new state
  needing a retry.
- `components/admin/RetryPendingButton.tsx` — only rendered when at least
  one subscriber needs it; posts the retry endpoint, shows "Retried N: X
  sent[, Y failed]", then `router.refresh()`s so badges update.

## Known limitations

- Retry is manual — the admin has to notice the red badge and click the
  button. No scheduled/automatic retry exists. Fine for this shop's signup
  volume; would need a cron trigger (e.g. via a scheduled route + external
  pinger, or a queue) if volume grows enough that "admin notices" isn't a
  reliable enough recovery path.
- If `sendEmail` succeeds but the following `confirmEmailSentAt` write fails
  (e.g. a dropped DB connection), the send is still counted `succeeded` in
  the response (correct — the subscriber did get the email), but the row
  stays eligible and may get a second, duplicate confirmation email on the
  next retry. There's no atomic way to guarantee both the send and the DB
  write together without infrastructure (outbox/saga) well beyond what a
  manual admin retry needs at this scale — accepted, not fixed.
- The retry loop sends sequentially, one subscriber at a time (like
  `send/route.ts`), not concurrently. Deliberate: this app's subscriber
  volume is small, and parallel sends would risk tripping Resend's own rate
  limits for no real benefit here.
