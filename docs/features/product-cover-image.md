# Product cover image (admin only)

The `Product.coverImage` schema column now has admin UI and API support.
**Not shown anywhere on the public site.** Deliberately minimal and
self-contained so it can be removed cleanly if the feature is dropped.

## Admin form (`components/admin/ProductForm.tsx`)

- Full-width "Cover image" field below Description: a file input using the
  existing upload contract (POST `/api/admin/uploads` → `{ url }`, stored
  under `public/uploads/`), a preview of the current image (edit page or
  right after upload), and a Remove button that clears it.
- Upload state is its own `useAsyncAction`, so uploading never blocks Save
  or Sell one; failures show in the shared form error line.

## API

`parseProductInput` accepts an optional `coverImage` string (trimmed;
blank/absent → null) and `toProductData` stores it — POST and PATCH both
carry it with no route changes. Same contract as blog post cover images,
including no URL validation (admin-only input, not publicly rendered).

## Removal map (if the feature is dropped)

- ProductForm: `coverImage` state + `handleCoverUpload` + the one Field
- `ProductFormValues.coverImage`, one line in the edit page
- `lib/product-input.ts`: interface field + two mapping lines
- Tests named `coverImage`/`cover image` in `lib/product-input.test.ts`,
  `products.test.ts`, `ProductForm.test.tsx`

## Verified end-to-end

Uploaded a file in the browser → preview rendered from `/uploads/…` →
Save → reload → preview persisted → Remove + Save → cleared.
