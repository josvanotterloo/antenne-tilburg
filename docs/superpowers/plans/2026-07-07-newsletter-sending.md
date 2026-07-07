# Newsletter Sending Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to
> implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Double opt-in signup + admin composer + Resend-backed send to confirmed
subscribers, with one-click unsubscribe.

**Architecture:** Small isolated units (`lib/token`, `lib/email/*`, per-route handlers)
behind the existing Next.js App Router + Prisma patterns. Email HTML is rendered from
markdown with `react-markdown` + `renderToStaticMarkup` using inline styles. All tests
mock the Resend sender.

**Tech Stack:** Next.js 16, Prisma/Postgres, `resend` (new), `react-markdown` (existing),
vitest + @testing-library.

## Global Constraints
- Tests run via `bash .claude/skills/run-tests/scripts/run-tests.sh` (full suite only).
- Admin API handlers MUST call `requireAdmin()` first (`lib/api-auth.ts`).
- Base URL: `process.env.NEXTAUTH_URL ?? "http://localhost:3000"`.
- Email theme: `#000` bg, `#fff` text, `#6B7DC9` accent, JetBrains Mono for code/pre.
- Never send real email in tests — mock `lib/email/send.ts`.
- Immutable style, small files, explicit error handling (see ~/.claude coding-style).

---

### Task 1: Schema + migration + token helper
**Files:** Modify `prisma/schema.prisma`; Create `prisma/migrations/<ts>_newsletter_optin/migration.sql`;
Create `lib/token.ts`, `lib/token.test.ts`.

**Produces:** `newToken(): string` (64-char hex). `SubscriberStatus` enum;
`NewsletterSubscriber.status` (default PENDING), `.confirmToken` (unique).

- [ ] Test `lib/token.test.ts`: `newToken()` returns 64 hex chars; two calls differ.
- [ ] Implement `lib/token.ts`: `crypto.randomBytes(32).toString("hex")`.
- [ ] Edit schema: add enum + `status`/`confirmToken` fields (see spec).
- [ ] `npx prisma migrate dev --name newsletter_optin`; hand-edit the migration so the
      backfill sets existing rows `status='CONFIRMED'` and a per-row random
      `confirmToken` (use `gen_random_uuid()` / `md5(random())` in SQL for backfill),
      then `ALTER ... SET NOT NULL` + add the unique index.
- [ ] `npx prisma generate`. Run suite → green. Commit.

### Task 2: Email building blocks + `resend` dep
**Files:** Create `lib/email/send.ts`, `lib/email/render.tsx`, `lib/email/confirm.ts`,
`lib/email/render.test.tsx`. Modify `package.json` (add `resend`).

**Interfaces / Produces:**
- `sendEmail(args: { to: string; subject: string; html: string }): Promise<void>` —
  constructs `new Resend(process.env.RESEND_API_KEY)`, calls `.emails.send({ from:
  process.env.NEWSLETTER_FROM, to, subject, html })`, throws if the result has an error.
- `renderNewsletterEmail(args: { subject: string; body: string; unsubscribeUrl: string }): string`
- `renderConfirmEmail(args: { confirmUrl: string }): string`

- [ ] `npm install resend`.
- [ ] Test `render.test.tsx`: `renderNewsletterEmail({subject:"Hi", body:"**bold** and
      `crate`", unsubscribeUrl:"https://x/u?token=t"})` → string contains "Hi",
      "bold", "#6B7DC9", and the unsubscribe URL.
- [ ] Implement `render.tsx` (inline-styled react-markdown components + shell) and
      `confirm.ts`. Implement `send.ts`.
- [ ] Run suite → green. Commit.

### Task 3: Signup double opt-in (`POST /api/newsletter`) + form message
**Files:** Modify `app/api/newsletter/route.ts`, `app/api/newsletter/route.test.ts`,
`components/NewsletterForm.tsx`, `components/NewsletterForm.test.tsx`.

**Consumes:** `newToken`, `sendEmail`, `renderConfirmEmail`.

- [ ] Update route test: signup → `db.newsletterSubscriber.create` called with
      `status:"PENDING"` + a `confirmToken`; **mocked `sendEmail` called once** with a
      `to` = email and html containing `/api/newsletter/confirm?token=`; returns 201.
      Duplicate (P2002) → `{alreadySubscribed:true}`, sender NOT called. Send throws →
      row deleted, 500.
- [ ] Implement: generate token, create PENDING, render+send confirm; on send throw,
      `db.newsletterSubscriber.delete({where:{id}})` then 500.
- [ ] Update `NewsletterForm` success copy → "Check your email to confirm your
      subscription." Update its test.
- [ ] Suite → green. Commit.

### Task 4: Confirm route (`GET /api/newsletter/confirm`)
**Files:** Create `app/api/newsletter/confirm/route.ts`, `.../confirm/route.test.ts`.

- [ ] Tests: unknown token → 404; token with `createdAt` 49h ago → 400; fresh PENDING
      token → 200 and `update` sets `status:"CONFIRMED"`.
- [ ] Implement: read `token` from `req.nextUrl.searchParams`; `findUnique({where:
      {confirmToken}})`; null→404; expired (`Date.now()-createdAt > 48*3600e3`)→400;
      else update→CONFIRMED, return 200 styled HTML.
- [ ] Suite → green. Commit.

### Task 5: Unsubscribe route (`GET /api/newsletter/unsubscribe`)
**Files:** Create `app/api/newsletter/unsubscribe/route.ts`, `.../route.test.ts`.

- [ ] Tests: unknown token → 404; valid token → `db...delete` called, 200 styled HTML.
- [ ] Implement: findUnique by confirmToken; null→404; else delete→200.
- [ ] Suite → green. Commit.

### Task 6: Send input validator + send route (`POST /api/admin/newsletter/send`)
**Files:** Create `lib/newsletter-send-input.ts`, `lib/newsletter-send-input.test.ts`,
`app/api/admin/newsletter/send/route.ts`, `.../send/route.test.ts`.

**Produces:** `parseNewsletterSendInput(body): {ok:true,data:{subject,body}} |
{ok:false,error}`.

- [ ] Validator tests: valid+trim; blank subject; subject >150; blank body. Implement.
- [ ] Route tests: no session → 401; invalid body → 400; two CONFIRMED + one PENDING →
      mocked `sendEmail` called exactly twice (never for pending), returns
      `{sent:2,failed:0}`; sender throws for one recipient → `{sent:1,failed:1}`.
- [ ] Implement: `requireAdmin`; parse; `findMany({where:{status:"CONFIRMED"}})`; loop
      render+send with per-recipient try/catch; return counts.
- [ ] Suite → green. Commit.

### Task 7: Admin composer page
**Files:** Create `app/admin/content/newsletter/new/page.tsx`,
`components/admin/NewsletterComposer.tsx`, `components/admin/NewsletterComposer.test.tsx`.
Modify content nav (`app/admin/content/layout.tsx` or the nav component).

- [ ] Test: renders subject + body fields and a Send button; Preview toggle shows
      rendered markdown; Send posts to `/api/admin/newsletter/send` and shows
      "Sent to N subscribers" on `{sent:N}`.
- [ ] Implement composer (client) reusing `PostBody` for preview; page wrapper; nav link.
- [ ] Suite → green. Commit.

### Task 8: Subscriber list badges + count + export filter
**Files:** Modify `app/admin/settings/subscribers/page.tsx`,
`.../subscribers-page.test.tsx`, `app/api/admin/subscribers/export/route.ts`.

- [ ] Test: page shows a PENDING and a CONFIRMED row each with a status badge; header
      count = number of CONFIRMED only. Export query filters `status:"CONFIRMED"`.
- [ ] Implement: list all (ordered), badge per row, count = confirmed; export `where`.
- [ ] Suite → green. Commit.

### Task 9: Env docs
**Files:** Modify `.env.example`, `docs/instructions/admin-credentials.md`.
- [ ] Add `RESEND_API_KEY`, `NEWSLETTER_FROM` with comments. Commit.

### Task 10: Close-out
- [ ] `/code-review`, fix MEDIUM+; visual check composer + subscriber badges in browser;
      feature doc `docs/features/newsletter-sending.md`; session log
      `docs/sessions/2026-07-07-newsletter-sending.md`; merge ff, delete branch, push.

## Self-review
- Spec coverage: double opt-in (T3,T4), status/token model (T1), send (T6), email theme
  (T2), unsubscribe (T5), composer (T7), count/badge/export (T8), env docs (T9),
  close-out (T10). All covered.
- Types consistent: `newToken`, `sendEmail`, `renderNewsletterEmail`,
  `renderConfirmEmail`, `parseNewsletterSendInput` used with the same signatures across
  tasks.
- No placeholders.
