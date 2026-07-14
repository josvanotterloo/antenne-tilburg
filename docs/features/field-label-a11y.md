# Admin forms: real label association (htmlFor/id)

The per-form `Field` wrappers rendered a `<span>` instead of a `<label>`, so
most admin inputs had no proper accessible name (ProductForm papered over it
with `aria-label`s; PostForm and NoticeForm had nothing).

## What changed

- New shared `components/admin/Field.tsx`: renders `<label htmlFor>` when
  given `htmlFor`, or the same text as a `<span>` for non-labelable button
  groups (Condition, Status). Identical visual output.
- `ProductForm`, `PostForm`, `NoticeForm` use the shared Field; every
  input/textarea/combobox has an id derived from its field name; the
  `aria-label` workaround on ProductForm's plain inputs was removed.
- `Combobox` accepts an optional `id` passed to its input so an external
  label can associate with it (its internal `aria-label` stays, driven by
  the same `label` prop).

Already correct, untouched: PasswordForm, login page, NewsletterComposer
(proper htmlFor/id), NoticeForm's Active checkbox (wrapping label).
Deliberately left on `aria-label`: OpeningHoursForm and EmailForm — they
have no visible per-input label to associate (day names label whole rows;
EmailForm's heading is a section title), so `aria-label` is the right
mechanism there.

## Tests

- ProductForm: clicking a label focuses its field (the behavior htmlFor buys).
- PostForm / NoticeForm: every field is reachable via `getByLabelText` on its
  visible label.
