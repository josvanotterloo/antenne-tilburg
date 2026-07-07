# Newsletter sending — design

**Date:** 2026-07-07 · **Branch:** `feature/newsletter-sending`

## Goal
Turn the newsletter from a passive signup list into a working send channel:
double opt-in on signup, an admin composer, and a Resend-backed send to confirmed
subscribers, with one-click unsubscribe. The subscriber list + CSV export already
exist at `/admin/settings/subscribers`.

## Non-goals (YAGNI)
- No campaign history / sent-log table. The send route sends and reports a count.
- No scheduling, segmentation, templates library, or open/click tracking.
- No rate limiting on public endpoints (documented gap, consistent with the rest
  of the public API).

## Data model
Add to `prisma/schema.prisma`:

```prisma
enum SubscriberStatus {
  PENDING
  CONFIRMED
}

model NewsletterSubscriber {
  id           String           @id @default(cuid())
  name         String
  email        String           @unique
  status       SubscriberStatus @default(PENDING)
  confirmToken String           @unique
  createdAt    DateTime         @default(now())
}
```

- `confirmToken` is generated once at signup and **retained after confirmation** —
  it doubles as the unsubscribe token (per spec, reuse the field).
- Migration backfills existing rows: `status = CONFIRMED` and a freshly generated
  `confirmToken` per row (they already opted in under the old single-step flow).
- 48h expiry is derived from `createdAt` at confirm time — no separate column.

## Building blocks (small, isolated, testable)
- **`lib/token.ts`** — `newToken(): string` = `crypto.randomBytes(32).toString("hex")`.
  Pure, trivially tested (length + uniqueness).
- **`lib/email/send.ts`** — `sendEmail({ to, subject, html }): Promise<void>` wrapping
  the `resend` npm package. Reads `RESEND_API_KEY` and `NEWSLETTER_FROM`. Throws on a
  Resend error so callers can decide how to handle it. Mocked in all tests — the suite
  never sends real email.
- **`lib/email/render.tsx`** — `renderNewsletterEmail({ subject, body, unsubscribeUrl }): string`.
  Renders the markdown `body` to an HTML string with `react-markdown` +
  `renderToStaticMarkup`, using components that emit **inline styles** (email clients
  strip `<link>`/most `<style>`). Theme: `#000` background, `#fff` text, `#6B7DC9`
  accent (links/headings), JetBrains Mono stack for `code`/`pre` (catalog data). Wraps
  the body in a table-based shell with the subject as an `<h1>` and an unsubscribe
  footer linking `unsubscribeUrl`.
- **`lib/email/confirm.ts`** — `renderConfirmEmail({ confirmUrl }): string`, same theme,
  a single "Confirm your subscription" button/link. Kept separate from the newsletter
  template (different purpose, different shape).
- Base URL: reuse the established pattern `process.env.NEXTAUTH_URL ?? "http://localhost:3000"`.

## Flows

### Signup — double opt-in (`POST /api/newsletter`)
- Validate via existing `parseNewsletterInput`.
- Create subscriber with `status: PENDING` and a new `confirmToken`.
- Send the confirmation email: link `${base}/api/newsletter/confirm?token=<token>`.
- Duplicate email (`P2002`) still returns `{ ok, alreadySubscribed }` (200) — no
  enumeration, no new email. (Simplest correct behaviour; not resending on dup.)
- On success return `{ ok: true }` (201). If the confirmation email **send throws**
  after the row was created, delete that just-created row and return 500 — this avoids
  an orphaned PENDING row that a retry would collide with (P2002) and never resend. A
  retry then starts clean.

### Confirm (`GET /api/newsletter/confirm?token=`)
- No/unknown token → **404**.
- Token found but `createdAt + 48h < now` → **400** ("link expired").
- Valid → set `status = CONFIRMED`, return **200**.
- All responses are small **self-contained styled HTML pages** (black bg / white text)
  returned directly from the route — no separate page files. Idempotent: confirming an
  already-CONFIRMED valid token returns 200 success.

### Unsubscribe (`GET /api/newsletter/unsubscribe?token=`)
- Valid token → delete the subscriber, return **200** styled HTML confirmation.
- No/unknown token → **404**.

### Send (`POST /api/admin/newsletter/send`)
- `requireAdmin()` guard first.
- Body `{ subject, body }`. Validate via `lib/newsletter-send-input.ts`
  (`parseNewsletterSendInput`): subject required, trimmed, ≤150 chars; body required,
  trimmed. Invalid → **400**.
- Fetch `status: CONFIRMED` subscribers. For each: render the email with that
  subscriber's personalized unsubscribe URL (`${base}/api/newsletter/unsubscribe?token=<confirmToken>`)
  and call `sendEmail`. Catch per-recipient errors and count them.
- Return `{ ok: true, sent: <n>, failed: <n> }` (200). Empty confirmed list → `sent: 0`.

## Admin UI

### Composer — `/admin/content/newsletter/new`
- Client component `NewsletterComposer`:
  - Subject `<input>`.
  - Body `<textarea>` (markdown), styled like `PostForm`'s body field.
  - **Preview** toggle: renders the body with `PostBody` (same react-markdown pipeline)
    so the admin sees the content as it will read.
  - **Send** button → `POST /api/admin/newsletter/send`; on success shows
    "Sent to N subscribers" (and failed count if any).
- Add a "Newsletter" link to the content section nav/layout.

### Subscriber list — `/admin/settings/subscribers`
- List **all** subscribers (PENDING + CONFIRMED), each row shows a **status badge**
  (PENDING = amber, CONFIRMED = green) so the admin can see who hasn't confirmed.
- Header **count** shows CONFIRMED only ("N confirmed subscribers"); pending excluded.
- **CSV export** stays CONFIRMED-only (unchanged filter added to the export query).

## Config
- New env: `RESEND_API_KEY`, `NEWSLETTER_FROM`. Document both in `.env.example` and in
  `docs/instructions/admin-credentials.md`. Base URL reuses `NEXTAUTH_URL`.

## Testing (TDD, one behaviour per test)
- `lib/token.test.ts` — token is hex, correct length, unique across calls.
- `lib/newsletter-send-input.test.ts` — valid; missing/blank subject; too-long subject;
  missing body; normalisation (trim).
- `lib/email/render.test.tsx` — output contains subject, rendered body text, the accent
  colour, and the unsubscribe URL.
- `app/api/newsletter/route.test.ts` (update) — signup creates PENDING and **calls the
  mocked sender** with a confirm link; duplicate → alreadySubscribed, no create.
- `app/api/newsletter/confirm/route.test.ts` — valid→CONFIRMED (200); expired→400;
  unknown→404.
- `app/api/newsletter/unsubscribe/route.test.ts` — valid→deleted (200); unknown→404.
- `app/api/admin/newsletter/send/route.test.ts` — 401 without admin; 400 on invalid
  subject/body; sends only to CONFIRMED (mocked sender called once per confirmed, never
  for pending); reports `failed` when the sender throws for a recipient.
- `components/NewsletterForm.test.tsx` (update) — success message is the
  "check your email" copy.
- Subscribers page test (update) — renders a status badge; count reflects CONFIRMED only.

## Commit units (each green + committed)
1. Schema + migration + `lib/token.ts` (+ regen client).
2. `lib/email/*` (send wrapper mocked, render, confirm) + `resend` dep.
3. Signup double opt-in (route + input already exists) + form message.
4. Confirm route.
5. Unsubscribe route.
6. `newsletter-send-input` + send route.
7. Admin composer page + content nav link.
8. Subscriber list badges + count + export filter.
9. Env docs (`.env.example`, admin-credentials.md).
10. Close-out docs (feature doc + session log).
