---
name: Antenne Tilburg
description: Pure-black, monospace-voiced storefront for an underground electronic record shop — pirate radio for vinyl.
colors:
  canvas: "#0A0B0D"
  surface: "#15171B"
  surface-raised: "#1E2127"
  ink: "#ECEDEF"
  ink-muted: "#9BA1AC"
  hairline: "#2A2D34"
  signal: "#6B7DC9"
typography:
  display:
    fontFamily: "Space Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(2.25rem, 6vw, 5rem)"
    fontWeight: 700
    lineHeight: 0.95
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "Space Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(1.5rem, 3vw, 2.25rem)"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Space Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Space Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "normal"
  label:
    fontFamily: "JetBrains Mono, ui-monospace, SFMono-Regular, monospace"
    fontSize: "0.8125rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "0.04em"
rounded:
  none: "0px"
  sm: "0px"
  md: "0px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "48px"
  xxl: "96px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.canvas}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "12px 24px"
  button-primary-hover:
    backgroundColor: "{colors.signal}"
    textColor: "{colors.canvas}"
  button-ghost:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "12px 24px"
  button-ghost-hover:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.signal}"
  input:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "10px 14px"
  badge-just-in:
    backgroundColor: "{colors.signal}"
    textColor: "{colors.canvas}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "2px 8px"
---

# Design System: Antenne Tilburg

## 1. Overview

**Creative North Star: "The Pirate Signal"**

A lone antenna broadcasting underground frequencies into the dark. The canvas is
pure black — dead air, the night, the back room of a vintage shop after close. The
monospace voice is the teletype readout of a transmission: catalog numbers, artist,
title, label, price, ticking out in even columns. A single muted-indigo accent is
the signal cutting through the static. And the static itself — a drifting field of
genre words behind the wordmark — is the broadcast made visible. This system
inherits the current antenne-tilburg.nl directly (black background, monospace type,
the antenna logo, the genre word-cloud) and modernizes its craft without sanitizing
its character.

The system is monochrome by doctrine. Colour is not a design element here — it is
delivered by record covers and event imagery placed *into* the black. The interface
gets exactly one hue, used sparingly, so that a sleeve photo detonates against it.
Density is editorial-sparse in the marketing surfaces (home, about, visit) and
catalog-dense in the stock surfaces (the arrivals table), and that shift is
deliberate: a collector reads a shelf differently than they read a story.

This system explicitly rejects the generic SaaS landing page (gradient hero,
feature-card grids, an uppercase eyebrow above every section), the cream/sand/paper
warm-neutral AI default (this is black, not beige), the big-box retail marketplace
(no star-rating product grids), and sterile brandless minimalism (minimal is not the
same as anonymous — the heritage motifs carry the hand).

**Key Characteristics:**
- Pure-black canvas; monochrome interface, colour supplied only by imagery.
- Monospace (JetBrains Mono) as the identity voice; a grotesk (Space Grotesk) for
  headings and reading.
- Zero border-radius everywhere — sharp, terminal-true corners.
- Flat by default: depth from tonal layering and hairlines, never shadow.
- One muted-indigo signal accent, used on ≤10% of any screen.
- Two signature motifs carried from the old site: the genre-static field and the
  monospace stock table.

## 2. Colors

A monochrome ramp from pure black to bone, cut once by a muted-indigo signal.

### Primary
- **Signal** (`#6B7DC9`, `oklch(0.61 0.12 272)`): the single accent — a muted
  periwinkle-indigo, softer and dustier than a neon blue. Links, active nav, focus
  rings, the "Just In" badge, hover states. Inherited from the muted blue of the old
  site's catalog links and pulled toward indigo. It clears the 4.5:1 floor on the
  black canvas (≈5.1:1), so it carries body-copy links directly — no brighter variant
  needed. Its rarity is the point: it must never become a second body colour.

### Neutral
- **Canvas** (`#0A0B0D`, `oklch(0.16 0.006 260)`): the near-pure-black page
  background. Everything lives on this. A whisper of cool chroma toward the signal
  hue, never toward warm.
- **Surface** (`#15171B`, `oklch(0.23 0.006 260)`): raised zones — alternating
  table rows, input fields, quiet panels. One step off the canvas, no more.
- **Surface Raised** (`#1E2127`, `oklch(0.28 0.007 260)`): hover rows, the top-most
  tonal layer. This is as light as any container ever gets.
- **Ink** (`#ECEDEF`, `oklch(0.94 0.003 260)`): primary text. Bone, not pure white,
  to cut glare on black.
- **Ink Muted** (`#9BA1AC`, `oklch(0.69 0.012 260)`): secondary text, metadata,
  captions, inactive nav. Holds ≥4.5:1 on canvas — never dropped lighter "for
  elegance."
- **Hairline** (`#2A2D34`, `oklch(0.31 0.008 260)`): 1px dividers and borders. The
  primary structural device in place of shadow.

### Named Rules
**The One Signal Rule.** Signal appears on ≤10% of any screen. It is the only
hue in the interface. If a second colour is creeping in that isn't a record cover or
event photo, delete it.

**The Records Bring the Colour Rule.** The interface is monochrome on purpose. All
vibrancy comes from imagery placed into the black. Never tint a surface, badge, or
heading "to add warmth."

## 3. Typography

**Display Font:** Space Grotesk (with `ui-sans-serif, system-ui` fallback)
**Body Font:** Space Grotesk (with `ui-sans-serif, system-ui` fallback)
**Label/Mono Font:** JetBrains Mono (with `ui-monospace, SFMono-Regular` fallback)

**Character:** A contrast pairing on the mono-vs-proportional axis. JetBrains Mono is
the machine voice — catalog data, nav, prices, badges, section labels, anything that
reads like a transmission readout. Space Grotesk is the human voice — headlines and
prose — technical-adjacent enough to sit with the mono, proportional enough to read
comfortably. Two families, no more.

### Hierarchy
- **Display** (Space Grotesk, 700, `clamp(2.25rem, 6vw, 5rem)`, line-height 0.95,
  tracking −0.03em): hero wordmark and page titles. Ceiling is 5rem — the page never
  shouts past it. Use `text-wrap: balance`.
- **Headline** (Space Grotesk, 700, `clamp(1.5rem, 3vw, 2.25rem)`, line-height 1.1,
  −0.02em): section headings ("Just In", "Upcoming events").
- **Title** (Space Grotesk, 500, 1.25rem, line-height 1.2): card and list-item
  titles, blog post titles in listings.
- **Body** (Space Grotesk, 400, 1.0625rem, line-height 1.6): prose on about, FAQ,
  blog, event detail. Cap measure at 65–75ch. Use `text-wrap: pretty`.
- **Label** (JetBrains Mono, 500, 0.8125rem, tracking 0.04em, often UPPERCASE):
  nav, eyebrows, metadata, prices, table headers, buttons, badges. The catalog voice.

### Named Rules
**The Machine-Voice Rule.** Anything that is data — a price, a catalog number, a
label name, a date, an opening-hours line, nav — is set in JetBrains Mono. Prose and
headlines are Space Grotesk. Never blur the two; the split *is* the system.

**The One Eyebrow Family Rule.** The mono label is the shop's kicker voice, but it is
not stamped above every section by reflex. Use it where it carries information (a
price, a date, a filter), not as decorative scaffolding.

## 4. Elevation

Flat by default. This system uses **no shadows** — pure black makes drop-shadows
invisible or muddy. Depth is conveyed entirely by **tonal layering** (Canvas →
Surface → Surface Raised) and **1px hairlines**. A row "lifts" on hover by moving one
tonal step (Surface → Surface Raised) and/or gaining a Signal focus ring, not by
casting a shadow.

The one permitted non-flat material is a soft **Signal glow** on focus
(`box-shadow: 0 0 0 2px var(--canvas), 0 0 0 3px var(--signal)` style ring, or a
low-opacity blue bloom), used only to make keyboard focus unmistakable.

### Named Rules
**The Flat Transmission Rule.** Surfaces are flat at rest. The only depth cue that
ever appears in response to state is a tonal step or a Signal focus ring. If you
reach for `box-shadow` to separate two black surfaces, add a hairline instead.

## 5. Components

### Buttons
- **Shape:** hard rectangles, zero radius (`0px`). Mono label text, often UPPERCASE,
  tracking 0.04em.
- **Primary:** solid Ink (bone) background, Canvas (black) text — a high-contrast
  inversion. Padding `12px 24px`. Hover: background shifts to Signal, text stays
  Canvas.
- **Ghost:** transparent on Canvas with a 1px Hairline border, Ink text. Hover:
  background to Surface, text and border to Signal. The default for
  secondary actions and most public-site CTAs.
- **Focus:** Signal focus ring (see Elevation) on every interactive element.

### Chips / Filters (stock page)
- **Style:** mono label, 1px Hairline border, transparent background, zero radius.
- **State:** unselected = Ink Muted text / Hairline border; selected = Canvas text on
  a Signal fill (or Ink text with a Signal border). Selection is never conveyed by
  colour alone — the selected chip also carries a leading `×`/check glyph or bold
  weight.

### Cards / Containers
- **Corner Style:** zero radius. Cards are used sparingly — hairline-separated rows
  and bare cover-plus-metadata blocks are preferred over boxed cards.
- **Background:** Canvas, or Surface for a quiet raised panel. Never nested.
- **Shadow Strategy:** none — see Elevation. Separation by Hairline or tonal step.
- **Border:** 1px Hairline where a container edge is needed.
- **Internal Padding:** `16px`–`24px` (`md`–`lg`).

### Inputs / Fields
- **Style:** Canvas background, 1px Hairline border, mono text, zero radius.
- **Focus:** border shifts to Signal, plus the Signal focus glow. No inner shadow.
- **Error:** border and helper text in a desaturated warm red; the message is always
  text, never colour alone. **Disabled:** Ink Muted text, Surface background.

### Navigation
- **Style:** mono UPPERCASE labels, tracking 0.04em, Ink Muted at rest. Hover → Ink.
  Active route → Ink with a 1px Signal underline (offset below the label).
- **Mobile:** collapses to a full-screen black overlay; nav links stack large, mono,
  left-aligned. No hamburger-into-white-drawer; the overlay stays on Canvas.

### The Genre-Static Field (signature)
The home hero carries the heritage motif: a dense, low-contrast field of genre words
(techno, dub, electro, breakbeat, drone, jungle…) set in mono at Ink Muted on Canvas,
tightly packed as broadcast static, with the "Antenne" antenna wordmark centered over
it. On capable devices it drifts almost imperceptibly (a few px over many seconds);
under `prefers-reduced-motion` it is completely static. It is texture, not content —
never place essential information only in the static field.

### The Stock Table (signature)
The catalog voice made literal, inherited from the old site: a monospace table —
Type · Artist · Title · Label · Price · condition — Ink data on Canvas, alternating
Surface rows, hairline column rhythm, links in Signal. On mobile it reflows to
stacked rows (cover thumbnail + mono metadata block), never a horizontally-scrolling
table. "Just In" items carry the Signal badge.

## 6. Do's and Don'ts

### Do:
- **Do** keep the canvas pure black (`#0A0B0D`) on every public page; let record
  covers be the only source of colour.
- **Do** set all data — prices, catalog numbers, labels, dates, opening hours, nav —
  in JetBrains Mono, and all prose/headlines in Space Grotesk (the Machine-Voice
  Rule).
- **Do** use zero border-radius everywhere; corners are sharp and terminal-true.
- **Do** separate surfaces with a 1px Hairline or a one-step tonal shift, never a
  shadow (the Flat Transmission Rule).
- **Do** reserve Signal for ≤10% of a screen; at ≈5.1:1 on black it carries body
  links directly while staying scarce.
- **Do** give every animation a `prefers-reduced-motion` alternative, including the
  genre-static drift.

### Don't:
- **Don't** introduce a cream / sand / paper / beige body background, or any
  warm-neutral surface — the AI-default look this brand explicitly rejects.
- **Don't** build a generic SaaS landing page: no gradient hero, no feature-card
  grid, no tiny tracked-uppercase eyebrow stamped above every section.
- **Don't** make it a big-box retail marketplace grid with star ratings and badges
  on every product.
- **Don't** add a second interface hue, tint surfaces "for warmth," or use gradient
  text — the interface is monochrome (the One Signal / Records Bring the Colour
  Rules).
- **Don't** use `border-left`/`border-right` colour stripes, glassmorphism, or
  drop-shadows to fake depth on black.
- **Don't** convey state (selected filter, sold, error) with colour alone; always
  pair it with text, weight, or a glyph for colour-blind users.
