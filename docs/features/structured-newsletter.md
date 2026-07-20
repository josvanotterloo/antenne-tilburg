# Structured newsletter composer

Replaces the blank subject/markdown composer with a three-part builder:
Header (persisted) → New Arrivals (auto-populated) → Footer (persisted).

## Data model

`NewsletterTemplate` — singleton row (fixed id `"singleton"`, upsert on
save) holding `headerText`/`footerText`; `updatedAt` doubles as "last
saved/used". Migration `20260717073054_newsletter_template` is
hand-trimmed to the CreateTable: `prisma migrate dev`'s auto-diff also
tried to drop the manually-migrated FTS/trigram indexes (schema drift
against `catalog_fuzzy_search`) — expect the same if you run `migrate dev`
again; hand-write migrations or trim the diff.

## Composer (`/admin/content/newsletter/new`)

- **Header / Footer**: markdown textareas pre-populated from the template
  (server component passes them as props). Saved on every send, or
  explicitly via *Save template*. The contact block is appended
  automatically at render time. **Social links are not** — the shop owner
  types them into the header directly (changed 2026-07-20: auto-appending
  them duplicated links for shop owners who already included their own).
- **New arrivals**: from/to date inputs (default: Monday of the current
  shop week → today, Europe/Amsterdam via `shopDateISO`/`weekRange`).
  *Load arrivals* fetches in-stock products created in the range, grouped
  by genre (A-Z), artists A-Z, `*` on restocks (shared `isRestock`, 60s
  epsilon). Format: `ARTIST [label catalogNumber]`, catalog number omitted
  when absent.
- **Preview**: assembled email — header md, mono arrivals block, footer md,
  contact line. Mirrors the real renderer's output (no fabricated blocks
  the real email doesn't contain).
- **Send**: posts `{subject, header, footer, from, to}`; the server
  re-assembles (never trusts client HTML), upserts the template, sends to
  all CONFIRMED subscribers via the existing per-recipient loop, and keeps
  the post-success duplicate-blast lock.

## API

- `GET/POST /api/admin/newsletter/template` — singleton load/upsert
  (empty defaults before first save).
- `GET /api/admin/newsletter/arrivals?from&to` — grouped arrivals for the
  composer (400 on malformed/reversed range).
- `POST /api/admin/newsletter/send` — structured contract (deliberate
  interface change; input/route/integration tests migrated with it).

## Email rendering

`renderStructuredNewsletterEmail` (lib/email/render.ts): subject h1 →
header markdown → "New arrivals" + escaped `<pre>` block ("No new arrivals
in this period." when empty) → footer markdown → contact line →
personalised unsubscribe. Contact data comes from `lib/shop-info.ts`, the
single source shared with SiteFooter (there is no DB table for it — the
spec's "pulled from DB" is satisfied by one canonical module matching the
footer). `SOCIAL_LINKS` also lives in `shop-info.ts` for SiteFooter/
SocialLinks, but the email renderer no longer reads it (see below). The
old `renderNewsletterEmail` stays: its tests carry the markdown-engine
regression coverage used by the structured renderer.

Body paragraphs and the arrivals `<pre>` block share one `BASE_FONT_SIZE`
(16px) constant, fixed 2026-07-20 after the `<pre>` block hardcoded 13px
against the (inherited) 15px body size and visibly mismatched in preview.

## Verified end-to-end (dev)

Loaded arrivals for 1–17 July against the real dev DB: three genre groups,
correct restock stars (matching the Back In Stock page), preview assembled
all parts, template survived a page reload. Send not exercised against the
subscriber list (no test blast); the send path is covered by route +
integration tests.
