# Newsletter sending

**Status:** branch `feature/newsletter-sending` — merged to `master` (2026-07-07).
Spec: `docs/superpowers/specs/2026-07-07-newsletter-sending-design.md`.
Plan: `docs/superpowers/plans/2026-07-07-newsletter-sending.md`.

## Summary
Turns the newsletter list into a working send channel: double opt-in signup, an
admin composer, a Resend-backed send to confirmed subscribers, and one-click
unsubscribe.

## What's in place
- **Model:** `NewsletterSubscriber` gains `status` (`PENDING`/`CONFIRMED`, enum
  `SubscriberStatus`) and a unique `confirmToken`. Migration `20260707140000_newsletter_optin`
  backfills existing rows to `CONFIRMED` with a generated token. `confirmToken` is
  reused as the unsubscribe token.
- **`lib/token.ts`:** `newToken()` — 32 random bytes as hex.
- **`lib/email/`:** `theme` (dark palette + inline-styled HTML shell), `render`
  (`render.ts` — a small hand-rolled markdown → inline-styled-HTML **string**
  renderer; see note below), `confirm` (opt-in email), `send` (Resend wrapper).
  New dep: `resend`.
- **Signup (`POST /api/newsletter`):** creates `PENDING` + token, emails a confirm
  link. If the email send fails, the row is rolled back so a retry starts clean.
  Duplicate email → `alreadySubscribed` (no enumeration). Form shows a
  "check your email" message.
- **Confirm (`GET /api/newsletter/confirm`):** unknown token 404, expired
  (`createdAt+48h`) 400, valid → `CONFIRMED` 200. Self-contained styled page.
- **Unsubscribe (`GET /api/newsletter/unsubscribe`):** valid token deletes the
  subscriber (200), unknown 404.
- **Send (`POST /api/admin/newsletter/send`, admin):** validates subject
  (≤150)/body, renders per recipient with a personalised unsubscribe link, sends to
  `CONFIRMED` only, returns `{sent, failed}` (per-recipient errors counted).
- **Composer (`/admin/content/newsletter/new`):** subject + markdown body, Preview
  toggle (reuses `PostBody`), Send button reporting how many were reached. Linked
  from the content sub-nav.
- **Subscriber list:** all rows shown with a `PENDING`/`CONFIRMED` badge; headline
  count and CSV export are confirmed-only.

## Config
`RESEND_API_KEY` + `NEWSLETTER_FROM` (see `docs/instructions/admin-credentials.md`).
The `NEWSLETTER_FROM` domain must be verified in Resend for delivery. Confirm/
unsubscribe links use `NEXTAUTH_URL`. Tests mock the sender.

## Tests & verification
- **26 new tests (310 total green):** token; email render (incl. a font-family
  regression); signup double opt-in; confirm; unsubscribe; send-input validator;
  send route; composer; subscriber badges/count; export filter. `tsc` + lint clean.
- **Live visual check:** rendered the newsletter + confirm emails and drove the
  admin composer/subscriber list in-browser. This caught a real bug — double-quoted
  font names broke the `style` attribute and the email fell back to serif; fixed by
  single-quoting the font stacks (guarded by a regression test).

## Known gaps (deliberate, MVP)
- **No campaign history** — sends are fire-and-forget; no sent-log table.
- **No rate limiting** on the public signup/confirm/unsubscribe endpoints
  (consistent with the rest of the public API).
- **GET confirm/unsubscribe links** can be triggered by email link-scanners/
  prefetchers (inherent to one-click links). Acceptable for this shop; revisit with
  RFC 8058 `List-Unsubscribe-Post` if abuse appears.
- **Per-recipient markdown re-render** in the send loop — fine at shop scale; render
  the body once if the list grows large.
- **Duplicate pending signup** does not resend the confirmation (returns
  `alreadySubscribed`).

## Email rendering (string-based)
`lib/email/render.ts` renders markdown to HTML as **plain strings** — no
`react-dom/server` / `renderToStaticMarkup`, which isn't allowed in an App Router
route handler (the send route imports the renderer, so it must build server-side).
It covers the same markdown subset `PostBody` renders (headings `##`/`###`, `**bold**`,
`*italic*`/`_italic_`, `` `code` ``, fenced ```` ``` ````, links, images, `-`/`1.`
lists, `>` blockquotes, `---` rules) with inline styles, and escapes raw HTML so
admin-authored markdown has no injection surface.

- **Preview vs email:** the composer preview uses `PostBody` (react-markdown) while
  the sent email uses this string renderer. They match for the common subset above;
  edge cases react-markdown supports but this renderer doesn't (`__bold__`, `####+`,
  nested lists) render literally in the email. Keep newsletter markdown to the subset.
