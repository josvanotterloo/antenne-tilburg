# Design: Dymo Label Printing

Date: 2026-08-05

## Summary

Admin-only label printing for products, using a Dymo LabelWriter and label
part 99012 (89×36mm). A pure function generates DYMO Connect Framework XML
for a product; an API route serves that XML for manual verification in
DYMO Connect Desktop (dev/default mode) or POSTs it to the local DYMO web
service to print directly (production mode). The print action is only
offered for products with every field the label needs.

## Label content (89×36mm, part 99012)

```
ARTIST(S)                                    ← uppercase, bold, large
Title                                        ← mixed case, bold, large
Label name                    Cat# · Format · Condition
Genre              ANTENNE TILBURG              € Price
```

- Multiple artists: joined `" / "`, whole line uppercased.
- Missing catalog number: right side of line 3 becomes `Format · Condition`
  (no dangling separator) — the only field this function itself tolerates
  being absent, since it's the one optional field (`catalogNumber String?`)
  among the fields the label uses.
- Condition: `NEW` → `"Nieuw"`, `SECONDHAND` → `"Tweedehands"`.
- Price: `€ ${Number(price).toFixed(2)}`.

## `lib/dymo-label.ts`

Two pure exports:

### `generateLabelXml(product: CatalogProduct): string`

Reuses the existing `CatalogProduct` type from `lib/catalog.ts` (already
has `label`, `genre`, `productType`, `productArtists.artist`, plus every
scalar field) — no new type.

Builds a DYMO `DieCutLabel` XML document: `Version="8.0"`,
`Units="twips"`, `PaperOrientation=Landscape`, `PaperName` referencing
`99012`, canvas 5040×2040 twips (89mm×36mm; 1mm = 56.69 twips, per the
user-supplied conversion — used verbatim, not recomputed), a
`RoundRectangle` draw command sized to the canvas, and one
`ObjectInfo`/`TextObject` per text element below. Text content is
XML-escaped by a small local `escapeXml` helper (not imported from
`lib/rss.ts` — that one is private to and untouched by this feature;
duplicating 5 lines beats coupling two unrelated modules).

Layout (all positions in twips; landscape canvas is 5040 wide × 2040 tall):

| Row | Y | Height | Font | Objects |
|---|---|---|---|---|
| 1 Artist | 60 | 640 | 16pt bold | one, X=80 W=4880, Left, uppercase, `TextFitMode=ShrinkToFit` |
| 2 Title | 700 | 560 | 14pt bold | one, X=80 W=4880, Left, `TextFitMode=ShrinkToFit` |
| 3 Label / Cat·Format·Cond | 1260 | 380 | 9pt | left: label name, X=80 W=2400, Left. right: `[catalogNumber, productType.name, conditionLabel].filter(Boolean).join(" · ")`, X=2560 W=2400, Right |
| 4 Genre / Brand / Price | 1640 | 340 | 9pt (brand bold) | left: genre, X=80 W=1600, Left. center: `"ANTENNE TILBURG"`, X=1680 W=1680, Center, bold. right: `€ price`, X=3360 W=1600, Right |

Rows sum exactly to the canvas: 60 (top margin) + 640 + 560 + 380 + 340 +
60 (bottom margin) = 2040.

### `missingLabelFields(product: CatalogProduct): string[]`

Returns a human-readable list of missing required fields — `"Artist"`,
`"Title"`, `"Price"`, `"Label"`, `"Genre"`, `"Product Type"` — checking:
at least one entry in `productArtists`; non-blank `title`; non-null
`price`; and truthy `label`/`genre`/`productType`. Empty array = safe to
print. (Most of these are DB-required today, so this is a defensive
belt-and-suspenders check, not a workaround for a currently-reachable
data state — but it's what gates the UI per the approved design, and it's
cheap.)

## `GET /api/admin/label/[productId]`

1. `requireAdmin()` first — returns its standard 401 JSON response if
   unauthenticated. (The originating request described this as "redirect
   to login," but that contradicts its own TDD line — "returns 401" — and
   `requireAdmin()` (`lib/api-auth.ts`) always returns 401 JSON, never a
   redirect, in every existing admin API route. Going with 401 for
   consistency.)
2. Fetch the product via `db.product.findUnique` with the same relations
   as `CATALOG_INCLUDE`. 404 (`NextResponse.json({error}, {status:404})`)
   if not found.
3. Call `missingLabelFields(product)`. If non-empty, 422 with
   `{ error: "Missing required fields", fields: [...] }` — closes the gap
   where a hidden UI button doesn't stop a direct URL hit.
4. Call `generateLabelXml(product)`.
5. Branch on `DYMO_MODE` (default `"preview"` if unset):
   - `"preview"`: `new Response(xml, { headers: { "content-type": "text/xml", "content-disposition": "inline" } })`.
   - `"print"`: POST form-encoded (`printerName`, `labelXml`) via a plain
     `fetch()` — not the `dymo-connect-framework` npm package, per the
     project's minimal-dependency convention (5 production deps today) and
     because this is one HTTP call, simpler to read/test/debug as a direct
     fetch — to `http://localhost:41951/DYMO/DLS/Printing/PrintLabel`.
     `printerName` comes from the new `DYMO_PRINTER_NAME` env var; 500 with
     a clear error message if that's unset while `DYMO_MODE=print`. On
     success, relay a small JSON confirmation; on failure, relay the error.

## Admin integration

- **Edit page** (`app/admin/catalog/[id]/edit/page.tsx`): between the
  `<h1>` and `<ProductForm>`, compute `missingLabelFields(product)`. If
  empty: a plain `<a href="/api/admin/label/{id}" target="_blank"
  rel="noopener noreferrer">Print label</a>`. If non-empty: a small note,
  e.g. *"Print label unavailable — missing: Price, Genre."* Lives in the
  page, not inside `ProductForm.tsx`, since `ProductForm` is shared with
  `/admin/catalog/new` where there's no product id yet — keeps
  `ProductForm`'s props unchanged.
- **List rows** (`app/admin/catalog/page.tsx`): same guard: a small
  icon-link (🖨️, matching this codebase's existing plain-emoji/text-link
  icon style — no icon library dependency) next to Sell one / Edit /
  Delete, only rendered when `missingLabelFields` is empty for that row.

## Env vars

`.env.example` and `.env.local` (not read/quoted here — permission-denied
by design; edits are additive, append-only, don't require reading
existing secret values) get two new lines:

```
DYMO_MODE=preview        # preview: show XML in browser | print: send to Dymo Connect
DYMO_PRINTER_NAME=       # required when DYMO_MODE=print — exact name from Dymo Connect
```

`.env.local` gets `DYMO_MODE=preview` (matching current dev default;
`DYMO_PRINTER_NAME` left unset since preview mode doesn't need it).

## Testing

- `lib/dymo-label.test.ts`: `generateLabelXml` — well-formed XML containing
  uppercase artist, `" / "`-joined multiple artists, `Nieuw`/`Tweedehands`
  condition mapping, catalog-number-omitted formatting, format present on
  line 3, `€ XX.XX` price formatting, XML-escaping of special characters
  in artist/title/label names. `missingLabelFields` — empty array for a
  complete product; correct field names for each single-field-missing
  case and for multiple missing at once.
- `app/api/admin/label/[productId]/route.test.ts`: 401 unauthenticated;
  404 unknown product; 422 with field list for an incomplete product;
  `text/xml` content-type + `inline` disposition in preview mode (default
  and explicit); print-mode POST target/body shape (mocked `fetch`, not a
  real DYMO service); 500 with a clear message when `DYMO_MODE=print` and
  `DYMO_PRINTER_NAME` is unset.
- `app/admin/catalog/[id]/edit/edit-page.test.tsx` (existing file, extend):
  print button renders with the correct href for a complete product; the
  missing-fields note renders instead, listing the right fields, for an
  incomplete one.
- `app/admin/catalog/catalog.test.tsx` (existing file, extend): print icon
  renders with the correct href per complete-product row; absent for an
  incomplete-product row.

## Out of scope

- No schema changes — all fields the label needs already exist.
- No real DYMO Connect / physical printer interaction is testable in this
  environment; `"print"` mode's POST is unit-tested against a mocked
  `fetch`, not verified against a live DYMO service. Manual verification
  (copy `preview` mode's XML into DYMO Connect Desktop) is the user's own
  built-in verification step, unchanged from the original request.
- No change to `ProductForm.tsx`'s props/interface.
