# SocialLinks on the home page

**Status:** branch `feature/home-social` — merged to `master` (2026-07-06).

## Summary
Reuses the existing `SocialLinks` component in a "Follow us" section on the home page
(the last public surface item for it; the footer already uses it).

## What changed
- `app/(public)/page.tsx`: a "Follow us" section (mono label + `<SocialLinks />`) after
  the Visit teaser.

## Tests
- Home page test asserts the Facebook social link renders with the correct URL (the
  component itself is already covered by `components/SocialLinks.test.tsx`). 285 green;
  `tsc` clean.

## Note
- The site footer's FOLLOW column also renders `SocialLinks` on every page, so at the
  very bottom of the home page the socials appear twice in close succession (content
  section + footer). Deliberate per the request; move/remove one if the redundancy
  bothers.
