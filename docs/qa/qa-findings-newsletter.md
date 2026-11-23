# QA findings — newsletter

> **OUTDATED, read only.** N1, N2, N3, and N5 are fixed/answered in current
> code. Only N4 (move Subscribers) is still open — see `tasks/todo.md`'s QA
> backlog. Do not act on this file as a live task list.

Source: manual QA pass, 10 Oct 2026, reviewing the newsletter compose/preview
flow. Ties to the open "newsletter end-to-end" go-live item. None is a blocker
on its own.

---

## N1 — Footer address block: remove, or stack the lines
Severity: low (content/layout preference)

The newsletter footer renders a one-line address joined by `·` separators:

    Antenne Recordshop · Noordstraat 82, 5038 EK Tilburg · Inside Sam-Sam
    vintage clothing store · +31 13 542 1708

which wraps awkwardly. This is almost certainly hardcoded in the newsletter
email template/layout (a React Email component or an HTML string in the send
code), not in the per-newsletter content.

Preferred: remove the address block.
If it stays: stack each component on its own line instead of inline `·`:

    Antenne Recordshop
    Noordstraat 82, 5038 EK Tilburg
    Inside Sam-Sam vintage clothing store
    +31 13 542 1708

Constraints, do not remove in the same change:
- The unsubscribe link must remain — functionally and legally required for bulk
  mail.
- A sender identity (name + physical address) in bulk mail is legally advisable
  and helps deliverability/spam filtering. Decide consciously before dropping it
  entirely.

Acceptance: footer either omits the address block (unsubscribe link still
present), or shows each address component on its own line.

---

## N2 — Bare URLs not rendered as links
Severity: medium (affects the actual product — links are the point of the mix posts)

Raw URLs in the body (e.g. the SoundCloud mix links) render as plain text, not
clickable links. Markdown does not autolink bare URLs unless the GFM autolink
extension is enabled in the renderer.

Fix options:
- Enable GFM autolink in the markdown renderer, or
- Author links as `[DMDNMIX 111](https://soundcloud.com/...)` or `<https://...>`.

Deeper check — preview/send parity: confirm the Preview uses the SAME renderer as
the actual send. If preview and sent email differ, that is the real defect: a
link may look broken in preview but work in the mail, or vice versa. Verify with
a test send to a real inbox and compare against the preview. This is the heart of
the open "newsletter end-to-end" item.

Acceptance: URLs are clickable in both the preview and the delivered email, and
the two render identically.

---

## N3 — Open question: is the template stored in the database?
Severity: n/a (investigation, not a defect)

To verify in code (could not confirm from outside the repo):
- `prisma/schema.prisma` — is there a Newsletter model, and what fields does it
  hold (subject, body, …)?
- The send code that builds the email — does it pull a template from the database
  or from a component/HTML string in code?

Expected architecture: each newsletter's CONTENT (subject + body you type) is in
the database; the TEMPLATE/layout around it (header, footer, styling) lives in
code. Confirm this, because it determines where N1 and N2 get fixed — in the
template component (code) vs. in stored content.

Acceptance: documented answer to where content vs. template live, so footer and
link fixes are made in the right place.

---

## N4 — Move Subscribers from Settings to the Newsletter section
Severity: low (information architecture / UX)

Subscribers currently live at `/admin/settings/subscribers`. Conceptually they
belong with the newsletter (compose is at `/admin/content/newsletter/new`), so
everything newsletter-related sits in one place — clearer for the shop operator.

Preferred: move the route to sit beside compose, e.g.
`/admin/content/newsletter/subscribers`, and regroup the nav item under the
Newsletter section. (Lighter alternative: regroup the nav item only and leave the
route under settings — but then the URL no longer matches where it appears.)

Points to handle with the move:
- Add a redirect from the old `/admin/settings/subscribers` so existing bookmarks
  don't break.
- Update every nav link and any code reference pointing at the old path.
- Update tests that hit `/admin/settings/subscribers` (there are almost certainly
  some from the QA steps).
- Route move → send it through the `/code-review` gate.

Acceptance: Subscribers is reachable under the Newsletter section at its new path,
the old path redirects, nav and tests updated, review passed.

---

## N5 — Preview does not match the delivered email (parity)
Severity: HIGH (the preview is misleading; it gives false confidence)

Comparing the compose Preview against the actual received email shows they render
differently. The preview is therefore not trustworthy — worse than no preview,
because the author formats against it and the work does not carry through.
Supersedes/explains part of N2.

Observed differences (same source text):
- **Line breaks lost in the email.** Author used double-space hard breaks
  throughout; preview keeps them, the email collapses them (list items and the
  facebook/instagram line run together). Likely cause: the email pipeline trims
  trailing whitespace before parsing, killing the markdown hard breaks, while the
  preview does not.
- **Bare URLs not clickable.** `[text](url)` links work in the email; raw
  `https://…` do not. (This one is consistent — bare URLs are not autolinked in
  the preview either. = N2.)

Root cause hypothesis: two separate render paths — one for the preview component,
one for the outgoing email build — handling whitespace (and possibly more)
differently.

Fix, in order:
1. **Single render path.** Preview and send must call the exact same
   markdown→HTML function. Do this first; everything else is unverifiable until
   preview reflects reality.
2. **Robust line breaks.** Stop relying on double-space hard breaks (invisible,
   easily stripped). Use blank-line paragraph separation; ensure the markdown→HTML
   step emits proper `<p>`/`<br>`. The `*` bullet lists already survive — it's the
   loose newlines that are lost.
3. **Enable GFM autolink** so bare URLs become clickable (N2).

First diagnostic for Claude Code: locate the preview component and the email-build
code and confirm whether they share one render function. That is the finding
everything hangs on.

Acceptance: a test send to a real inbox renders identically to the preview —
line breaks, paragraphs, bullets and links all match — and both use one shared
render pipeline.
