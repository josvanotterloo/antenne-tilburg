# Product

## Register

brand

## Users

Record collectors and electronic-music heads. Two overlapping groups:

- **Local crate-diggers** in and around Tilburg who visit the physical shop inside
  Sam-Sam vintage. They care about labels, catalog numbers, pressings, and
  condition (new vs second-hand). They check "what's just in" and plan a visit.
- **Online buyers** browsing the shop's independent Discogs stock, prepared for
  next-day pickup at Antenne (not shipped).

Context of use: mostly phones, often on the move — deciding whether to make the
trip, checking opening hours, scanning new arrivals, reading a short blog post,
or seeing what event is next. Run by DJ DMDN; the audience trusts the shop's ear.

## Product Purpose

The digital storefront and noticeboard for a specialist electronic-vinyl shop.
It surfaces new arrivals fast, makes stock browsable and filterable (genre,
label, type, condition, Just In), drives foot traffic and Discogs pickups, and
builds a following through blog posts and events. Architected so online purchase
can be added later without rework.

Success looks like: collectors habitually check the site for "what's just in,"
plan visits from it, and read it as the authentic voice of the shop — not a
generic e-commerce template.

## Brand Personality

**Underground. Precise. Human.**

DJ-run and record-literate. Unpretentious expertise — it knows the pressings
without showing off. The spirit is pirate radio: *Antenne* means antenna, and the
shop broadcasts underground frequencies from a back room of a vintage store. Voice
is spare, confident, lowercase-comfortable, never hypey or corporate. Warmth comes
from the curation and the records, not from decoration.

## Anti-references

- **Generic SaaS / startup marketing.** No gradient hero, no feature-card grid, no
  tiny tracked-uppercase eyebrow above every section, no rounded-corner template.
- **The cream / sand / paper warm-neutral AI default.** This site is black. Warmth,
  where it exists, is carried by cover art and copy, never a beige body background.
- **Big-box retail marketplace.** Not a soulless product grid with star ratings and
  badges everywhere. This is a curated shop, not Bol or Amazon.
- **Sterile, brandless minimalism.** Minimal, yes — but not anonymous. The black +
  monospace + antenna heritage is the identity; keep its hand and character.

## Design Principles

1. **Signal over noise.** Every element earns its place. The stock and the shop's
   words are the content; chrome recedes into the black.
2. **Honor the transmission.** Preserve the heritage — pure-black canvas, monospace
   voice, the antenna and genre-static motifs. Modernize the craft, don't sanitize
   the character.
3. **The records bring the color.** The interface is monochrome by doctrine; cover
   art and event imagery supply all the vibrancy.
4. **Catalog-true.** Data-forward and precise — artist, title, label, catalog
   number, price, condition. Respect how a collector actually reads a shelf.
5. **Legible on a phone at a gig.** Performance, contrast, and reduced-motion are
   non-negotiable, not polish added later.

## Accessibility & Inclusion

Target **WCAG 2.1 AA**. Body text holds ≥4.5:1 against the black canvas; the single
indigo signal accent (`#6B7DC9`) clears ≈5.1:1 on the canvas, so it carries body-copy
links directly without a brighter fallback (see DESIGN.md). Full keyboard navigation
with a visible focus state, semantic markup, and a `prefers-reduced-motion`
alternative for every animation. Never rely on the signal accent alone to convey
meaning (state is also carried by text or shape) so the site works for color-blind
users.
