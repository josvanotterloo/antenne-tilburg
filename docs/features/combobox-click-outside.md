# Combobox click-outside close

The label, genre and product-type comboboxes in the admin product form stayed
open when the user clicked elsewhere on the page without selecting an option.

## Behaviour

- Clicking anywhere outside an open combobox closes its dropdown immediately,
  without changing the selection.
- Clicking inside the combobox (input or option list) does not close it —
  selection via option click still works as before.
- Implemented with a document-level `mousedown` listener that is attached only
  while the dropdown is open and checks the click target against the
  component's root element (`components/ui/Combobox.tsx`).

## Tests

Behavioral tests in `components/ui/Combobox.test.tsx`:
- "closes when the user clicks outside without selecting"
- "stays open when the user clicks inside the combobox"

## Also in this change

`scripts/run-tests.sh` — the run-tests skill referenced this script but it had
never been committed. It now exists and runs the full suite (`npm test`).
