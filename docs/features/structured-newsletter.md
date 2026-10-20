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

### Backslash-escaped characters

`markdownToHtml` (used by both header and footer) supports `\*`, `\_` and
`\\` as escapes for a literal character, fixed 2026-07-21: the engine
previously had no escape mechanism, so a run like `\*\*\*\*\*\*\*\*` (an
escaped divider line, e.g. framing "discogs") got misread by the italic
regex as mismatched emphasis pairs instead of eight literal asterisks.
`ESCAPED_CHAR` is stashed via the same sentinel mechanism as built
links/images, before any emphasis parsing runs, in `formatEmphasis`.

**Superseded (2026-10-20, Unit 3/N5):** consecutive non-blank lines within
one markdown block used to join into a single paragraph with a space
(soft-wrap) — an escaped divider line, its content, and a closing divider
line rendered as one line, not three stacked lines, unless separated by a
blank line. Fixed below (N2): line breaks are now structural (`<br>`).

**Superseded (2026-10-20, Unit 3/N5):** the *composer's live preview* used
`react-markdown` via `PostBody` — a different renderer than the actual send
path (`markdownToHtml`), so matching output between the two was
coincidental, not guaranteed. The preview now renders through
`markdownToHtml` directly (same section below).

### Unit 3 (2026-10-20): preview/send parity, autolink, structural line
breaks, stacked footer

Found via manual QA (`docs/qa/qa-findings-newsletter.md`) and fixed in
order:

- **N5 — parity.** The compose preview (`NewsletterComposer.tsx`) now calls
  `markdownToHtml` directly for header and footer, injected via
  `dangerouslySetInnerHTML` (the function escapes all raw HTML in its input
  before building any tags, so this carries no new injection surface beyond
  what already ships in the real email). Preview and sent email are
  byte-identical by construction, not by luck.
- **N2 — autolink + robust line breaks.** Bare `https://` URLs now
  autolink (`BARE_URL_RE` in `lib/email/render.ts`, a boundary-aware regex
  that stops before a trailing emphasis marker, an unbalanced closing `)`,
  or an escaped `&lt;`/`&gt;`/`&quot;` entity, re-pairing the trimmed-off
  trailing text with whatever markdown surrounds it — `splitUrlTrailing`).
  Paragraph lines join via a sentinel line-break marker, swapped for a real
  `<br>` only after inline rendering completes (not a blanket `\n` → `<br>`
  replace, which would also corrupt a literal newline surviving inside a
  restored attribute, e.g. multi-line image alt text) — structural, with no
  dependence on the old, fragile trailing-double-space hard-break
  convention.
- **N1 — footer, stacked.** The footer address block (name, address, note,
  phone) is centralised in `footerAddressHtml()` (`lib/email/render.ts`),
  used by both the send renderer and the preview — previously hand-
  duplicated in both places. Stacked one line per field instead of the old
  single `·`-joined line, which wrapped awkwardly. Kept, not removed: a
  physical sender address in bulk mail is legally advisable, and the
  unsubscribe link is unaffected either way.

**Security note (@code-reviewer finding, 2026-10-20):** `escapeHtml`
prevents breaking out of an HTML attribute/tag, but cannot stop a dangerous
URL *scheme* — a stored `[click](javascript:...)` would survive escaping
unchanged and execute when clicked. `isSafeUrl()` (`lib/email/render.ts`)
allowlists `http(s)`/`mailto`/`tel`/relative URLs for the explicit
`[label](url)`/`![alt](url)` syntax; anything else renders as the original
literal markdown text instead of becoming a link. (The bare-URL autolink
needs no such check — its own regex only ever matches an `http(s)` prefix.)

## Verified end-to-end (dev)

Loaded arrivals for 1–17 July against the real dev DB: three genre groups,
correct restock stars (matching the Back In Stock page), preview assembled
all parts, template survived a page reload. Send not exercised against the
subscriber list (no test blast); the send path is covered by route +
integration tests.
