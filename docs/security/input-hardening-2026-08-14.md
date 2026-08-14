# Public free-text input hardening — 2026-08-14

Audit of every public (unauthenticated) input field for length limits,
control-character handling, and injection risk (XSS + prompt injection).
Companion to `docs/security/owasp-audit-2026-07-09.md` — this pass is
narrower (input hardening specifically) and more recent.

## Public route inventory

Every route under `app/api/` that isn't `/api/admin/*` (all of which are
already confirmed `requireAdmin`-guarded per the OWASP audit) or NextAuth's
own handler:

| Route | Method | Free text? |
|---|---|---|
| `app/api/newsletter/route.ts` | POST | Yes — `name` + `email` |
| `app/api/catalog/route.ts` | GET | `genre`/`condition`/`limit` query params feed a parameterized Prisma `where` filter for a read-only feed; nothing persisted or shown in an admin view |
| `app/api/newsletter/confirm/route.ts` | GET | No — a server-generated `confirmToken`, used only as a Prisma lookup key |
| `app/api/newsletter/unsubscribe/route.ts` | GET, POST | Same — `confirmToken` only |

**The only public free-text field in this app is the newsletter signup's
`name` and `email`** (`lib/newsletter-input.ts`). There is no public
notes/description field anywhere — the want-list form was removed
(`docs/features/remove-want-list.md`), and blog/post content is
admin-authored, not public input.

## What was already in place

- `name` was already capped at 100 characters (`lib/newsletter-input.ts`).
- CSV export (`lib/csv.ts`'s `escapeCell`) already neutralizes spreadsheet
  formula injection (leading `= + - @ \t \r`) and quotes cells containing
  `, " \n \r` — covers `name`/`email` in `app/api/admin/subscribers/export/route.ts`.
- JSON-LD `<script>` tags (`app/(public)/page.tsx`, `faq/page.tsx`,
  `stock/[id]/page.tsx` — the only `dangerouslySetInnerHTML` uses in the
  whole app) are routed through `lib/json-ld.ts`'s `serializeJsonLd()`,
  which escapes `<` to block `</script>` breakout from DB-sourced content.
- Zero `dangerouslySetInnerHTML` uses in any admin component — grepped
  `app/` and `components/` directly. The subscriber `name` field is
  rendered as plain JSX (`app/admin/settings/subscribers/page.tsx`), which
  React escapes by default.
- Traced `name`'s only two uses end to end: stored via
  `db.newsletterSubscriber.create`, and displayed in the admin subscriber
  table. Never interpolated into an email template, never used as an email
  header or `from` display name.

## What changed

- `lib/newsletter-input.ts`: added `MAX_EMAIL = 254` (RFC 5321 §4.5.3.1.3)
  with a clear `400` message, matching the existing `MAX_NAME` pattern.
- Added `stripControlChars()`, applied to both `name` and `email` before
  trimming: strips `\x00-\x08`, `\x0B`, `\x0C`, `\x0E-\x1F`, `\x7F` (C0
  controls except `\t \n \r`, plus DEL) — never legitimate in a name or
  email address, and can otherwise cause rendering glitches in the admin
  table or CSV export.
- Documented the prompt-injection rule separately:
  `docs/security/prompt-injection-policy.md` — not applicable to this
  codebase today (no LLM-backed feature reads user input), written so a
  future session adding one knows the rule exists.

## Not fixed, out of scope for this pass

- `app/api/catalog/route.ts`'s query params — not persisted, not shown in
  an admin view, already parameterized via Prisma. No action needed.
- Anything already covered by the 2026-07-09 OWASP audit's Low/Open items
  (session length, unsubscribe-on-GET, `NEXTAUTH_URL` fallback, etc.) —
  unrelated to input hardening, left as tracked there.
