# Admin fetch error handling (visible failures)

**Status:** branch `feature/admin-fetch-error-handling` — merged to `master` (2026-07-10).

Closes the systemic Low from the Phase 3 review
(`docs/security/code-review-2026-07-09.md`): admin mutation components either
swallowed failures silently or left a button stuck disabled on a network reject.
Now every admin mutation fails **visibly and clearly** so the shop owner always
knows whether an action completed.

## Shared primitives
- **`lib/api-client.ts` — `apiSend(input, init?)`**: thin fetch wrapper that
  turns both silent failure modes into thrown, human-readable Errors — network
  failure → "Couldn't reach the server…"; non-ok → the server's `{ error }`
  message (or a generic fallback). Returns parsed JSON on success.
- **`lib/use-async-action.ts` — `useAsyncAction()`**: `{ pending, error, setError,
  run }`. `run(fn)` guarantees the two things every hand-rolled handler kept
  getting wrong: `pending` is **always** reset (the missing `finally`, so no
  stuck button), and a thrown error is captured into `error` for display.

Pattern: `run(async () => { await apiSend(url, {…}); router.refresh(); })` plus
`{error && <p role="alert">{error}</p>}`.

## Components migrated
Silent no-op → visible (highest value): **PostActions**, **NoticeActions**.
Stuck-flag / no message on reject: **DeleteButton**, **DeleteProductButton**,
**SellOneButton**, **Combobox** (quick-add), **EmailForm**, **PasswordForm**,
**NoticeForm**, **OpeningHoursForm**, **ProductForm** (submit + sell-one),
**PostForm** (upload + submit), **ReferenceSection** (add/rename/delete).

Forms with two independent actions (ProductForm, PostForm) use two hook
instances so neither action's pending state disables the other's button.

**Not migrated:** `NewsletterComposer` already had robust handling (its own
try/catch → connection message, non-ok error display, and the post-send lock)
and a distinct shape (needs `sent`/`failed` counts + a 3-state machine).
`NewsletterForm` (public) already wraps fetch in try/catch.

## Tests & verification
- 413 tests green (23 new: `apiSend` (success/empty/non-ok/no-body/network/
  passthrough), `useAsyncAction` (pending reset on throw, error capture,
  clear-on-rerun), and failure-path component tests for PostActions,
  NoticeActions, DeleteButton, SellOneButton rendering a visible `role="alert"`
  and skipping `router.refresh()`). `tsc`, lint, `next build` clean.
- The component tests render the real components and assert the alert appears on
  both failure modes (non-ok response and rejected fetch); only the network
  boundary is mocked.
