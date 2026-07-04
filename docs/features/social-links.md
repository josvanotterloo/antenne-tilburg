# SocialLinks + newsletter "Stay Connected"

**Status:** branch `feature/social-links` — merged to `master` (2026-07-04).

## Summary
A reusable `SocialLinks` component and a "Stay Connected" section on `/newsletter`
pairing the signup form with follow-us icons.

## What's in place
- **`components/SocialLinks.tsx`:** three inline-SVG icon links (no icon library) —
  Facebook, Instagram, SoundCloud — each `target="_blank" rel="noopener noreferrer"`,
  `aria-label`led, icon `aria-hidden`. DESIGN.md styling: square (zero-radius) hairline
  buttons, `currentColor` icons that turn `#6B7DC9` on hover (border + glyph). Takes an
  optional `className` so the footer/home can reuse it with different layout.
  - URLs: facebook.com/antennerecordshop/, instagram.com/antenne.recordshop/,
    soundcloud.com/antennerecordshoptilburg
  - SoundCloud icon is a hand-built waveform-bars + cloud mark (kept simple and
    recognisable rather than pulling the full brand path).
- **`/newsletter`:** now a "Stay Connected" page — a "Newsletter" part (the existing
  `NewsletterForm`, reused unchanged) and a hairline-separated "Follow us" part
  (`SocialLinks`).

## Tests & verification
- **3 tests** (247 total green): the three links resolve to the right URLs, all open in
  a new tab with `rel="noopener noreferrer"`, and the `className` passes through.
  `tsc` + lint clean.
- **Live:** all three icons render recognisably on the black canvas; hover shows the
  signal border + icon colour.

## Follow-up
- Reuse `SocialLinks` in the footer and home page (backlog item added).
