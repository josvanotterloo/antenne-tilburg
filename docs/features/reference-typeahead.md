# Server-side typeahead for reference comboboxes

At hundreds-to-thousands of labels, preloading every option into the product
form's comboboxes doesn't scale. Labels, genres and product types are now
searched server-side as the user types.

## API

`GET /api/admin/labels?q=tre` (same for `genres`, `product-types`):
- case-insensitive substring match on `name`
- alphabetical, capped at 20 results
- empty/missing `q` returns the first 20 alphabetically, so the dropdown
  still shows a list on focus
- shared implementation in `lib/reference-crud.ts` (`collectionHandlers`)

This is a deliberate contract change from "GET returns all rows". The only
GET consumer is the combobox; the admin reference-data page reads via Prisma
directly and is unaffected.

## Combobox (`components/ui/Combobox.tsx`)

- Props changed: `endpoint` (GET search + POST quick-add) replaces
  `options`/`createEndpoint`/`onCreated`; `value`/`onChange` now carry the
  full `{ id, name }` option so the input can display the selected name
  without a preloaded list.
- Queries are debounced 200 ms; a sequence counter discards stale responses.
- Quick Add inline creation unchanged (POST, then select the created item).
- Clicking a focused-but-closed combobox reopens the list (previously only
  the focus event opened it).
- The edit product page now includes label/genre/productType relations to
  supply the selected names.

## Known lows (accepted)

- If an exact match exists but is outside the top-20 page, Quick Add is
  offered; the POST then surfaces the server's 409 "already exists" message.
- A failed suggestion fetch shows an inline error that clears on the next
  successful search.

## Tests

- `lib/reference-crud.test.ts` + `app/api/admin/reference-routes.test.ts`:
  `?q=` filter contract (case-insensitive, take 20, alphabetical) per resource.
- `components/ui/Combobox.test.tsx`: fetch-on-focus, debounced search,
  quick-add, selected-name display, click-outside, keyboard flows.
