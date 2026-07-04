# Public Visit page

**Status:** branch `feature/public-visit` (commits `ca422e0`, `781619c`) — merged to
`master` (2026-07-04).

## Summary
`/visit` — address, contact, opening hours pulled live from the DB, and a map. First
public info page on the design system.

## What's in place
- **`lib/opening-hours.ts`:** two pure, tested helpers — `formatHourRange` ("Closed"
  vs "opens–closes") and `orderOpeningHours` (reorders rows Monday-first per
  `WEEK_ORDER`, skips missing days).
- **`/visit`:** async server component (`force-dynamic`). Renders the static shop
  contact block (venue, address, phone `tel:`, email `mailto:`), a "Get directions ↗"
  link to Google Maps, opening hours **live from `db.openingHours`** (Monday-first,
  today's row highlighted with a signal "Today" tag), and an OpenStreetMap `<iframe>`
  embed centred on the shop with a marker. Degrades gracefully (try/catch → "please
  call ahead") when hours can't load.
- Address geocoded via Nominatim: "Sam-Sam, Noordstraat 82, 5038 EK Tilburg"
  (`51.5580667, 5.0809368`).

## Design decisions
- Contact details (address/phone/email) are static constants in the page — there's no
  contact model; the comment flags where to update. Opening hours are the only
  DB-backed part (they change; the rest doesn't).
- Map uses an OpenStreetMap embed (no API key, no tracking cookies) rather than Google
  Maps embed — privacy-preserving per PRODUCT.md. The directions link goes to Google
  Maps (opens in a new tab).

## Tests & verification
- **9 tests** (216 total green): `formatHourRange`/`orderOpeningHours` (ordering,
  missing days, closed vs open); `/visit` renders address, live hours, `tel:`/`mailto:`
  links, a map/directions link, and the empty-hours fallback. `tsc` + lint clean.
- **Live:** address + Monday-first hours render, "Saturday · Today" highlighted, the
  OSM map loads with the marker on Noordstraat.

## Known gaps
- Footer still lists hours Sunday-first (unchanged); Visit is Monday-first. Minor; the
  footer could adopt `orderOpeningHours` in a later reuse pass.
