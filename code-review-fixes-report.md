# Code review fixes — order-transaction-redesign

Branch: `feature/order-transaction-redesign`. All 5 findings from the
`/code-review` run addressed. Full suite green (862 tests / 134 files) before
committing.

## Finding 1 — DELETE race condition on order lines

**File:** `app/api/admin/orders/lines/[id]/route.ts`

Moved the guard-read, guard-checks, and delete for `DELETE` into a single
`db.$transaction`, re-reading the line via the transaction client (`tx`)
instead of the pre-transaction `db` read. Followed the discriminated-result
pattern already used in `lib/supply-order-quick-add.ts` /
`app/api/admin/orders/quick-add/route.ts` (`{ok:true}` vs
`{ok:false,status,error}` returned from inside the transaction, mapped to a
`NextResponse` outside it) rather than the receive route's throw/catch
pattern — that pattern only maps to a single status code (400), but DELETE
needs to preserve two distinct codes (404, 409), so the discriminated-result
shape was the cleaner fit for this file. Status codes and error message text
are byte-for-byte unchanged.

```ts
async function deleteOrderLine(tx: Prisma.TransactionClient, id: string): Promise<DeleteLineResult> {
  const line = await findLineWithOrder(tx, id);
  if (!line) return { ok: false, status: 404, error: "Not found" };
  if (line.supplyOrder.status !== "PENDING") return { ok: false, status: 409, error: "..." };
  if (line.quantityReceived > 0) return { ok: false, status: 409, error: "..." };
  await tx.supplyOrderLine.delete({ where: { id } });
  return { ok: true };
}

export async function DELETE(_req: Request, ctx: RouteContext) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await ctx.params;
  const result = await db.$transaction((tx) => deleteOrderLine(tx, id));
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true });
}
```

**TDD:** Extended `app/api/admin/orders/lines/[id]/route.test.ts`. Introduced
a `tx` test double (distinct from the top-level `db` mock, mirroring
`receive/route.test.ts`'s established pattern/comment) and rewired the four
existing `DELETE` tests to set up state via `tx.supplyOrderLine.findUnique`
and assert on `tx.supplyOrderLine.delete` instead of the top-level `db`
mock — necessary because the fix moves those calls behind
`db.$transaction`, so the top-level mock is no longer what the code
actually calls. Added a fifth, new test that specifically asserts:
`db.$transaction` was called exactly once, the read and the delete both go
through `tx` (not `db`), and `db.supplyOrderLine.findUnique`/`.delete` are
never called directly — this is the "transaction boundary" regression guard
the finding asked for. Ran `npx vitest run app/api/admin/orders/lines/[id]/route.test.ts`
before writing the fix (existing tests as originally written would have
failed against a `tx`-based implementation) and after (11/11 pass).

**Note on Test Contract:** the four pre-existing `DELETE` tests' mock setup
(`line.findUnique` → `tx.supplyOrderLine.findUnique`, same for `delete`) did
change. This is exactly the deliberate implementation change Finding 1
mandates (move the read+delete inside a transaction), and the finding
explicitly directed following `receive/route.test.ts`'s prior precedent for
this same kind of change (its own comment references "the (now-removed)
whole-order receive route's test this was modeled on"). No assertion about
observable behavior (status codes, response bodies) changed — only which
mock object the setup/assertions target, because the client object the code
calls through changed. Flagging this explicitly per the Test Contract.

## Finding 2 — stale error masking in OrderLineRow

**File:** `components/admin/OrderLineRow.tsx`

Added a `clearOtherErrors(except)` helper called at the start of
`saveQuantity`, `confirmReceive`, and `confirmRemove`, clearing the other two
actions' `error` state via their existing `setError(null)` (from
`useAsyncAction`). This is on top of `useAsyncAction.run`'s own
`setError(null)` at the start of the just-started action, so at any moment
at most one of the three action errors is non-null, and the `??` fallback
chain (unchanged) now can't show a stale error from a different action.

**TDD:** Added a test to `components/admin/OrderLineRow.test.tsx`: trigger a
client-side quantity-validation error (no fetch involved), then trigger a
remove that fails server-side with a different message; assert the remove's
error is shown and the earlier quantity error is gone. Ran it against the
unmodified component first — failed as expected (`findByText` for the
remove error timed out, stale quantity error was still in the DOM). Applied
the fix; re-ran — 13/13 pass (originally 13 including the new one; 12 pre-
existing + 1 new).

## Finding 3 — Remove button not order-status-aware

**Files:**
- `components/admin/OrderLineRow.tsx` — added `orderStatus: "PENDING" |
  "PARTIAL" | "RECEIVED"` to `OrderLineRowData`; gated the Remove button's
  rendering on `quantityReceived === 0 && line.orderStatus === "PENDING"`
  (was `quantityReceived === 0` only). Updated the adjacent comment.
- `app/admin/catalog/orders/page.tsx` — `toRowData` now sets
  `orderStatus: line.supplyOrder.status` (from `OpenOrderLine`, which
  already carried `supplyOrder.status` — confirmed in `lib/order-overview.ts`,
  no change needed there).
- `components/admin/OrderLineRow.test.tsx`,
  `components/admin/SupplierOrderGroup.test.tsx`,
  `components/admin/OrderLinesTable.test.tsx` — each constructs an
  `OrderLineRowData` `LINE` fixture (grepped for every construction site);
  added `orderStatus: "PENDING"` to all three so the existing/passing test
  cases keep their prior (pre-fix) behavior by default.

`SupplierOrderGroup.tsx` itself doesn't construct `OrderLineRowData` — it
receives `lines: OrderLineRowData[]` as a prop and passes them straight
through to `OrderLinesTable`, so no code change was needed there beyond the
test fixture. `OrderLinesTable.tsx` similarly just forwards `lines` to
`OrderLineRow`.

**TDD:** Added a new test to `OrderLineRow.test.tsx`: a line with
`quantityReceived: 0, orderStatus: "PARTIAL"` should not render the Remove
button. Ran before the fix — failed (button was present). Applied the fix —
14/14 pass.

**Server guard unchanged:** `DELETE`'s two guard checks
(`supplyOrder.status !== "PENDING"` → 409, `quantityReceived > 0` → 409) are
untouched by this finding — same messages, same codes, still authoritative.
This finding is purely a client-side rendering gate to avoid an
always-fails round trip.

## Finding 5 — DRY: shared `findLineWithOrder` helper

**File:** `app/api/admin/orders/lines/[id]/route.ts`

Per the finding's own caveat, a full one-size-fits-all helper across `PATCH`
(reads via plain `db`) and `DELETE` (now reads via `tx`, per Finding 1) isn't
clean, since the two handlers need different post-read handling (`PATCH`
returns a `NextResponse` directly; `DELETE` returns a `DeleteLineResult` for
the caller to map). Extracted only the genuinely-shared part — the
`findUnique({ where: { id }, include: { supplyOrder: true } })` query
shape — into a small `findLineWithOrder(client, id)` function typed to
accept `Prisma.TransactionClient | typeof db` (both expose the same
`supplyOrderLine.findUnique` shape). Each handler keeps its own 404-handling
right after the call. `npx tsc --noEmit` confirms this typing is sound (both
`db` and a `tx` callback parameter satisfy it without casts).

## Finding 4 — DeleteButton reuse (not applied — documented reason)

**Files read in full:** `components/admin/DeleteButton.tsx`,
`components/admin/OrderLineRow.tsx`.

`DeleteButton` owns its own `useAsyncAction` internally and renders its own
independent `role="alert"` error `<span>`, uncoordinated with anything
outside it. Finding 2's fix depends on `OrderLineRow` being able to reach
into all three actions' `setError` to enforce "only the most recent
failure is shown" — `qtyAction`, `receiveAction`, and (currently)
`removeAction` all live in `OrderLineRow` for exactly this reason. If
`DeleteButton` replaced the local remove implementation, its error would be
displayed via its own isolated span rather than through
`OrderLineRow`'s unified error paragraph, and `OrderLineRow` would have no
way to clear it when a *different* action starts (no `setError` is
exposed outward) — reintroducing a variant of the exact masking/stale-error
problem Finding 2 was written to close (now as two simultaneously-visible
error messages instead of one masking the other, arguably no better for the
admin). `DeleteButton`'s API (`endpoint`, `label`, `redirectTo`) is
otherwise a good match for `OrderLineRow`'s remove use case (DELETE +
`router.refresh()`), so if `useAsyncAction`/error-ownership were ever
lifted out of `DeleteButton` (e.g. accepting an externally-owned
`AsyncAction` instead of creating its own), this would become a clean swap.
For now, left `OrderLineRow`'s local two-click implementation as-is per the
finding's own "don't force an awkward abstraction" guidance.

## Self-review

- **Finding 1 race closure:** confirmed — `deleteOrderLine`'s read
  (`findLineWithOrder(tx, id)`), both guard checks, and the
  `tx.supplyOrderLine.delete` all execute against the same `tx` inside one
  `db.$transaction` call; no read happens before the transaction opens.
- **Finding 3 server guard:** confirmed unchanged — `DELETE`'s guard logic
  in `route.ts` (now inside `deleteOrderLine`) has the identical two checks,
  same status codes, same messages, as before this session's changes.
- **Test Contract:** no existing test's *assertions* (expected status
  codes, response bodies, rendered output) were changed. The `DELETE` test
  suite's mock *target* (`db` → `tx`) changed only because Finding 1 itself
  mandates that implementation change, per the finding's explicit
  instruction to follow the `receive/route.test.ts` precedent. Three test
  fixtures gained an added required field (`orderStatus: "PENDING"`) to
  match the new `OrderLineRowData` shape Finding 3 mandates — additive,
  not a change to any existing assertion.

## Files changed

- `app/api/admin/orders/lines/[id]/route.ts`
- `app/api/admin/orders/lines/[id]/route.test.ts`
- `components/admin/OrderLineRow.tsx`
- `components/admin/OrderLineRow.test.tsx`
- `components/admin/SupplierOrderGroup.test.tsx`
- `components/admin/OrderLinesTable.test.tsx`
- `app/admin/catalog/orders/page.tsx`

## Verification

- `npx tsc --noEmit -p .` — clean.
- `bash scripts/run-tests.sh` (full suite) — 134 files / 862 tests, all
  passing.

## Concerns

None blocking. One judgment call worth flagging to the user: Finding 4 was
not applied (see above) — `OrderLineRow`'s local two-click remove
implementation still duplicates `DeleteButton`'s UX pattern. This is a
pre-existing duplication, not something this session introduced or made
worse.

---

## Post-review fix-up (task review round)

A task review of the above work found one Critical and one Important issue.
Both were real; both are now fixed and covered by tests.

### Critical: Finding 1's transaction wrapping didn't actually close the race

**The gap:** the first pass wrapped `deleteOrderLine`'s read, guards, and
delete in `db.$transaction`, and the read used the `tx` client instead of
`db` — but the read itself was still a plain `tx.supplyOrderLine.findUnique`.
Under Postgres READ COMMITTED, a bare `SELECT` takes no row lock. So a
concurrent `PATCH .../receive` could still fully commit (increment
`quantityReceived`, flip the order status, insert a `StockTransaction`) in
the gap between DELETE's read and its `tx.supplyOrderLine.delete(...)` — and
the delete would proceed anyway, because its guard checks were computed
in-memory from the stale read and the `delete`'s `WHERE id = X` doesn't
re-encode them. Being "inside a transaction" only guaranteed atomicity of
DELETE's *own* writes, not isolation from a concurrent transaction's writes
to the same row — that requires an explicit lock. The mock-based "runs
inside a single transaction" test from the first pass proved the code
called `tx` instead of `db`; it could not and did not prove the race was
closed, since a mock can't model Postgres row-lock blocking.

**The fix:** `app/api/admin/orders/lines/[id]/route.ts` now has a
`findLineForDelete(tx, id)` helper that replaces the plain `findUnique` with
a raw `SELECT ... FOR UPDATE OF sl` (joining `SupplyOrder` for `status`),
following the exact locking-read pattern `lib/stock.ts`'s
`applyStockTransaction` already established in this codebase (there, `SELECT
... FOR UPDATE` on `Product` before writing it). `FOR UPDATE OF sl` locks
the `SupplyOrderLine` row for the rest of DELETE's transaction, so a
concurrent receive's `tx.supplyOrderLine.update(...)` on the same row now
blocks until DELETE's transaction commits or rolls back — whichever
transaction reaches the row first, the other is serialized behind it and
sees fresh data. `deleteOrderLine`'s guard checks now run against
`LockedOrderLine` (`quantityOrdered`, `quantityReceived`, `orderStatus`)
read from that locked row. A code comment on `findLineForDelete` explains
why the lock is required and explicitly warns against "simplifying" it back
to `findUnique`.

Also reverted Finding 5's `findLineWithOrder` shared-helper extraction:
once DELETE's read became a raw locking query with a different shape and
return type than PATCH's ORM `findUnique`, there was nothing left that was
genuinely shared between the two handlers (per Finding 5's own fallback
guidance to prefer a clean partial extraction over a forced one). PATCH's
`findUnique` call is now inlined back in place.

**Tests:** `app/api/admin/orders/lines/[id]/route.test.ts`'s `tx` double
now mocks `$queryRaw` (resolving to a row array) instead of `findUnique`.
The four existing DELETE guard-check tests were updated to mock
`tx.$queryRaw`'s resolved rows instead of `tx.supplyOrderLine.findUnique`'s
resolved object — required because the query shape itself changed, not a
change to any assertion about behavior. The wiring test was extended to
assert the raw SQL text passed to `tx.$queryRaw` contains `FOR UPDATE OF sl`
and targets `"SupplyOrderLine"`, with a comment explicitly stating what this
test does and does not prove: it's a regression guard for the query
*shape* (catches a regression back to a non-locking read), not evidence the
concurrency guarantee holds — that guarantee is a property of the real
`FOR UPDATE` clause running inside a real Postgres transaction, which a
mock cannot exercise.

### Important: Finding 2's fix had a residual gap for concurrently-triggered actions

**The gap:** `clearOtherErrors` (added in the first pass) only fires when an
action *starts*. Each of the three trigger controls (quantity input, Mark
received, Remove) was previously disabled only by its *own* action's
`pending` flag, so an admin could start a second action (e.g. click Remove →
Confirm) while a first (e.g. Mark received → Confirm) was still in flight.
If both later failed, both `.error` fields could end up non-null at once
with no ordering to resolve which should display — the same class of bug
Finding 2 targeted, just requiring two genuinely concurrent in-flight
actions instead of one stale one.

**The fix:** `components/admin/OrderLineRow.tsx` now computes `const
anyPending = qtyAction.pending || receiveAction.pending ||
removeAction.pending` and uses it (instead of each action's own `.pending`)
to disable all three trigger surfaces — the quantity input, the "Mark
received" toggle button, its "Confirm" button, and both the "Remove" button
and its "Confirm" button — whenever *any* action is in flight. This prevents
the concurrent-trigger case at the source rather than trying to reconcile
two simultaneously-failed errors after the fact, and matches how a single
admin actually uses this UI (one action at a time). "Cancel" buttons are
intentionally left unaffected by `anyPending` — they don't start a mutation,
so leaving them clickable lets an admin back out of a confirm state without
needing to wait.

**TDD:** added a test to `OrderLineRow.test.tsx` that starts a receive
(clicks Mark received → Confirm) against a `fetch` mock whose promise is
held open, then asserts the quantity input and the Remove button are both
disabled while that receive is still pending. Ran against the
pre-fix component first — failed (`toBeDisabled()` failed for both). Applied
the fix — passes. (The test resolves the held-open promise before finishing
and asserts on the receiving UI closing, rather than re-asserting the
quantity input is enabled afterwards — this line receives its full
remaining quantity, so the input is legitimately disabled afterwards for
the unrelated, pre-existing "line fully received" reason, and asserting on
that would conflate the two disabled reasons.)

### Verification (post-review)

- `npx tsc --noEmit -p .` — clean.
- `bash scripts/run-tests.sh` (full suite) — 134 files / 863 tests, all
  passing (+1 net test vs. the first pass: the DELETE "wiring" test was
  extended in place rather than duplicated; one new `OrderLineRow` test was
  added for the `anyPending` gating).

### Files touched in this fix-up round

- `app/api/admin/orders/lines/[id]/route.ts`
- `app/api/admin/orders/lines/[id]/route.test.ts`
- `components/admin/OrderLineRow.tsx`
- `components/admin/OrderLineRow.test.tsx`

### Self-review

- Finding 1 (this round): confirmed the guard-read now takes a `FOR UPDATE`
  lock on the `SupplyOrderLine` row inside the same transaction as the
  guard checks and the delete — a concurrent receive's row-level write to
  the same line is now genuinely serialized behind (or ahead of, with
  DELETE then correctly seeing the post-receive state and 409ing) DELETE's
  transaction, not just nominally "inside a transaction" with an unlocked
  read.
- Finding 2 (this round): confirmed no two trigger controls can be pending
  simultaneously anymore — starting any one action now disables the other
  two's triggers immediately, closing the concurrent-trigger gap without
  needing to reconcile two simultaneous errors after the fact.
- Test Contract: the four DELETE guard-check tests' mock setup changed from
  `tx.supplyOrderLine.findUnique` to `tx.$queryRaw` because Finding 1's
  actual fix (this round) changed the query itself from an ORM call to a
  raw locking query — same rationale as flagged in the first pass, now
  updated to match the corrected implementation. No assertion about
  observable route behavior (status codes, response bodies) changed.
