# Product form: two-column layout

The add/edit product form was a single ~10-field column that required
scrolling. It is now a responsive two-column grid (`max-w-3xl`,
`md:grid-cols-2`), per DESIGN.md §7 admin theme — same field styling,
tokens and control vocabulary as before; layout only.

## Column map (desktop)

| Left | Right |
|---|---|
| Artist | Title |
| Label | Genre |
| Product type | Condition |
| Price (€) | Quantity in stock (+ Sell one on edit) |
| Catalog number | — |
| Description (spans both) | |

On mobile (below `md`) the grid collapses to a single column in the same
reading order. Error message and Save/Cancel span both columns.

Not included: a Cover image slot was requested in the layout spec, but
products have no cover-image UI or API support (the `coverImage` column
exists in the schema, unwired) — adding it would be a logic change, out of
scope for this layout-only task. See the session log.

## Accessibility fix that rode along

The `Field` wrapper renders a `<span>`, not a `<label>`, so the plain inputs
(Artist, Title, Catalog number, Price, Description, Quantity) had no
accessible names. They now carry `aria-label`s matching their visible labels.
Follow-up worth doing: proper `htmlFor`/`id` association in `Field`.

## Tests (`components/admin/ProductForm.test.tsx`, new)

- Every field renders, queried by role + accessible name.
- Sell one appears only in edit mode.
- Submit round-trip: PATCH to `/api/admin/products/:id` with the form's
  values, then navigation back to `/admin/catalog`.
- No layout/CSS assertions, per the testing philosophy.
