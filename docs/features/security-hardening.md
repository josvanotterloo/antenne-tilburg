# Security hardening (code-review fixes)

**Status:** branch `feature/security-hardening` — merged to `master` (2026-07-08).

## Summary
Fixes for the five findings from a full-source security review, in priority order.
All TDD'd; no behaviour change for legitimate users.

## Fixes
1. **Rate limit on public newsletter signup** (`lib/rate-limit.ts`,
   `app/api/newsletter/route.ts`). Each signup sends a confirmation email, so an
   unthrottled flood was a spam / Resend-cost vector. Added an in-memory
   sliding-window limiter (5 per client IP per hour, keyed on `x-forwarded-for`);
   over the limit returns **429** before any DB write or send. In-process state —
   swap for a shared store (Redis) if scaled to multiple instances.
2. **Constant-time login** (`lib/authorize.ts`). Login now always runs a bcrypt
   compare — against a dummy cost-12 hash when the email is unknown — so response
   timing no longer reveals which addresses are registered (enumeration).
3. **Atomic sell-one** (`app/api/admin/products/[id]/sell-one/route.ts`). Replaced
   the read-then-write with a single `UPDATE ... SET quantity = GREATEST(0,
   quantity-1), inStock = (…>0) ... RETURNING`. Concurrent clicks can no longer
   lose a decrement, and a deleted row returns 404 (no rows) instead of racing.
   Removed the now-unused `sellOne` helper.
4. **Upload magic-byte sniffing** (`lib/upload-input.ts`,
   `app/api/admin/uploads/route.ts`). `validateUpload` determines the image format
   from the actual leading bytes (`sniffImageExt`) instead of the spoofable
   client Content-Type. Non-image bytes labelled `image/png` are rejected; SVG
   stays excluded. Size is guarded from metadata before the file is read.
5. **Strict quantity validation** (`lib/product-input.ts`). Quantity is accepted
   only as a plain number or a digits-only string (`/^\d+$/`), rejecting loose
   `Number()` coercions (booleans, `0x10`, `1e3`, floats).

## Tests & verification
- **340 tests green**, `tsc` + lint clean, `next build` passes.
- New unit tests: rate limiter (window/keys/reset), constant-time compare,
  atomic-route response handling, magic-byte sniffing (incl. spoofed `image/png`
  → rejected), strict quantity rejections.
- **Live against Postgres:** the atomic sell-one SQL — `1 → 0` (out of stock),
  `0 → 0` (floored, no negative), unknown id → 0 rows (→404) — then restored.

## Notes
- The rate limiter's bucket map isn't pruned of idle keys; negligible for this
  shop's traffic. Add eviction (or move to Redis) if IP cardinality grows.
