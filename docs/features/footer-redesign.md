# Footer redesign (three columns)

**Status:** branch `feature/footer-redesign` — merged to `master` (2026-07-04).

## Summary
Replaced the old two-column footer (which listed live opening hours) with a
three-column layout: FOLLOW, NAVIGATE, CONTACT, plus a full-width bottom bar.

## Structure
- **FOLLOW:** the reused `NewsletterForm` (name + email + Sign Up) and a "Follow us"
  label + the reused `SocialLinks` (Facebook / Instagram / SoundCloud).
- **NAVIGATE:** Stock, Blog, Visit, About, FAQ.
- **CONTACT:** Antenne Recordshop · Noordstraat 82, 5038 EK Tilburg · Inside Sam-Sam
  vintage clothing store · `tel:` +31 13 542 1708 · a "See full opening hours →" link
  to `/visit`.
- **Bottom bar** (full width, hairline top): `© {year} Antenne Recordshop` and an
  "Also on Discogs ↗" link → discogs.com/seller/antennetilburg (new tab,
  `rel="noopener noreferrer"`).

Three equal columns on desktop (`md:grid-cols-3`), stacked single column on mobile.
Styled per DESIGN.md: black canvas, JetBrains Mono, hairlines, zero radius, `#6B7DC9`
hover.

## Notable changes
- **Footer is no longer DB-backed.** The old footer queried `db.openingHours`; the new
  CONTACT column links to `/visit` for hours instead, so `SiteFooter` is now a plain
  sync component. (`orderOpeningHours`/`formatHourRange` remain used by the Visit page.)
- **`NewsletterForm` now uses `useId`** for its field ids, so it renders safely more
  than once per page — the footer form appears site-wide, and `/newsletter` also has
  one in its "Stay Connected" section.

## Tests & verification
- Rewrote `SiteFooter.test.tsx` (dropped the Monday-first hours tests, no longer
  applicable): asserts the three column headings, the five nav links + hrefs, the
  contact details + `tel:` link, an embedded social target, and the bottom-bar year +
  Discogs link (new tab). 250 tests green; `tsc` + lint clean.
- **Live:** three-column footer renders on every page; `/newsletter` shows both its
  page form and the footer form with no id collision.
