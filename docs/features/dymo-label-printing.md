# Dymo label printing

**Status:** Merged to `master` (2026-08-06) · branch `feature/dymo-label-printing`

Spec: `docs/superpowers/specs/2026-08-05-dymo-label-printing-design.md`
Plan: `docs/superpowers/plans/2026-08-05-dymo-label-printing.md`

## Summary

Admin-only label printing for products, using a Dymo LabelWriter and label
part **99012** (89×36mm). `lib/dymo-label.ts` is a pure function that builds
DYMO Connect Framework XML from a product; `GET /api/admin/label/[productId]`
serves that XML for manual verification (default) or POSTs it to the local
Dymo Connect service to print. The print action is only offered — on the
product edit page and the catalog list — for products with every field the
label needs.

## Label content

```
ARTIST(S)                                    ← uppercase, bold, large
Title                                        ← mixed case, bold, large
Label name                    Cat# · Format · Condition
Genre              ANTENNE TILBURG              € Price
```

Multiple artists: `" / "`-joined (via the shared `lib/catalog.ts`
`joinArtistNames`, not a local reimplementation), whole line uppercased.
Missing catalog number: right side of line 3 becomes `Format · Condition`.
Condition: `NEW` → `"Nieuw"`, `SECONDHAND` → `"Tweedehands"`.

## What changed

- **`lib/dymo-label.ts`** — `generateLabelXml(product)` builds the DieCutLabel
  XML (5040×2040 twips landscape); `missingLabelFields(product)` returns
  human-readable names of any missing required field (artist, title, price,
  label, genre, product type) — gates both UI touch points and the API route.
- **`GET /api/admin/label/[productId]`** — `requireAdmin()` → 404 if unknown
  → 422 with the missing-field list if `missingLabelFields` is non-empty →
  `text/xml; charset=utf-8` (default/`DYMO_MODE=preview`) or a form-encoded
  POST to `http://localhost:41951/DYMO/DLS/Printing/PrintLabel`
  (`DYMO_MODE=print`, `DYMO_PRINTER_NAME` env var selects the printer; a
  network failure — e.g. Dymo Connect Desktop not running — returns a clear
  502, not an uncaught throw).
- **Admin UI**: a "Print label" link on `/admin/catalog/[id]/edit` (or a
  missing-fields note if gated off), and a 🖨️ icon per row on
  `/admin/catalog`. Both open the route in a new tab; both use the same
  `missingLabelFields` guard as the API route, so there's no drift between
  what's offered and what the route will actually accept.
- **Env vars**: `.env.example`/`.env.local` get `DYMO_MODE=preview`;
  `.env.example` also documents `DYMO_PRINTER_NAME` (required for print mode).

## Review findings fixed along the way

- Task 2 fix round: print-mode's `fetch()` call had no network-failure
  handling — added try/catch, now a clear 502 instead of an opaque 500.
- Final review fix wave: missing `charset=utf-8` on the XML response (would
  have mojibake'd `€`/`·`/any non-ASCII name in the feature's default mode);
  a duplicated artist-joining helper that forked from `lib/catalog.ts`'s
  shared `joinArtistNames`; missing `ShrinkToFit` on the label/cat-info/genre
  text objects (overflow risk in narrow boxes); missing test coverage for
  Dymo Connect responding with a non-2xx status.

## Known open items (physical-printer verification, not yet done)

Nothing in this environment can exercise a real DYMO Connect installation.
Before switching `DYMO_MODE=print` in production, verify by hand:

1. **Paper `<Id>`/`<PaperName>`** (`lib/dymo-label.ts`, currently
   `<Id>Small99012</Id>` / `<PaperName>99012</PaperName>`) — paste a preview
   response into DYMO Connect Desktop and confirm it opens. If DYMO rejects
   an unrecognized paper id, the label won't open at all.
2. **Row 3/4 text fitting** — generate a preview for a product with a
   deliberately long label name and genre; confirm `ShrinkToFit` keeps text
   legible and rows 3/4 don't clip or run into the centered brand text.
3. **Print-success response shape** — confirm the Dymo Web Service's actual
   success/failure signal for this DYMO Connect version. The route currently
   trusts `res.ok` (HTTP status); if DYMO returns 200 with a body indicating
   failure (reported as true for some versions, unconfirmed here), a failed
   print would be reported to the admin as successful.
4. **GET-triggered print is not idempotent** — print mode fires on a plain
   GET (matches the original spec's "opens in a new tab" requirement), so
   browser link-prefetch or history-replay could in principle trigger an
   unwanted physical print once print mode is live. Preview mode is
   unaffected. Revisit (e.g. a POST-triggered client action, matching
   `DeleteProductButton`/`SellOneButton`'s pattern) if this proves to be a
   real problem in practice.

None of these affect `DYMO_MODE=preview`, the shipped default.
