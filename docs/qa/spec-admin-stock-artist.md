# Spec notes — admin stock & artist UX

> **OUTDATED, read only.** A1–A4, B1–B4, C1–C4, and D1–D4 are all built —
> see `components/admin/ReferenceSection.tsx`, `lib/reference-dedupe.ts`,
> `lib/product-adjust-input.ts`, `PlusOneButton.tsx`/`SellOneButton.tsx`.
> Kept as the record of the product rationale behind that code, not as an
> open task list.

Source: Jos, 11 Oct 2026, from live admin use. Feature requests + UX fixes across
product/stock management and artist entry. Not bugs from the QA checklist (except
A1, which is a genuine usability trap). Hand to Claude Code as a plan; each goes
through the normal branch → tests → /code-review loop. All touch admin mutations,
so each must keep requireAdmin() inside its handler and carry Gherkin coverage.

Context: in the shop, stock is derived from a StockTransaction ledger with a
denormalised quantity cache; quantity 0 = hidden on the public site. So a product
with no transaction is invisible. The artist table came from the legacy import and
is full of near-duplicates (e.g. "Jeff Mills", "JEFF MILLS", "JEFF MILLS & ROBERT
HOOD", "JEFF MILLS AND THE ZANZA 21", "INCLUDING JEFF MILLS REMIX" all as separate
rows).

================================================================================
A. PRODUCT & STOCK
================================================================================

## A1 — New products are invisible until a transaction exists
Severity: HIGH (usability trap — DJ DMDN will add products that silently don't show)

Creating a product writes no stock transaction, so quantity = 0 and it's hidden.
The operator has no reason to know they must then add a transaction.

DECIDED (Jos): quantity field on the create form, default 1, adjustable. On
create, write an initial StockTransaction of that amount. Handles "I have 3
copies" and "coming soon = 0 (intentionally hidden)".

Acceptance: a newly created product with quantity ≥ 1 appears on the public site
immediately, backed by an initial transaction of the chosen amount; quantity 0
stays hidden by choice.

## A2 — Drop the reason requirement entirely
Severity: low (quality of life)

DECIDED (Jos): no reason needed. Make the reason fully optional/nullable; remove
the prompt from the stock flows. No forced defaults.

Implication to handle: if the StockTransaction.reason column is currently NOT
NULL, make it nullable (migration). Once reasons are gone you lose the free-text
record of WHY a manual adjustment happened. If you ever want that back for free,
an automatic transaction TYPE/kind (INITIAL / SALE / RESTOCK / CORRECTION), set by
which action was used and never typed, preserves traceability without any input —
worth checking whether the ledger already distinguishes these. Optional; not
required by Jos.

Acceptance: stock can be created and adjusted with no reason entered anywhere; the
ledger still computes quantity correctly.

## A3 — "+1" button next to "Sell one"
Severity: low

Mirror the existing "Sell one" action (which writes −1). "+1" writes a +1
transaction, no reason (per A2).

Acceptance: "+1" increments stock by one, visible next to "Sell one".

## A4 — Clickable labels → label page (ADMIN only)
Severity: low (management feature)

DECIDED (Jos): admin only. The public site stays deliberately minimal (just the
last-added products, nothing else), so no public label pages and no SEO angle
here. This is a management view: in the admin product search/list, a label becomes
a link to a page showing all products on that label — a tool for the operator, not
a customer-facing page. Show all products regardless of stock (it's a management
view, not the public 0-hidden rule).

Acceptance: in admin, clicking a label opens a list of all products on that label.

================================================================================
B. ARTIST ENTRY
================================================================================

## B1 — Carry the typed search term into "add artist"
Severity: low (friction)

When an artist search returns no match, the add action should pre-fill the name
already typed, instead of making the operator retype it.

Acceptance: "add artist" opens with the searched term pre-filled.

## B2 — Confirmation on add
Severity: low

Show a confirmation (toast/message) when an artist is successfully added. Today
there is no feedback.

Acceptance: a visible success confirmation after adding an artist.

## B3 — Duplicate validation on add (two tiers, NOT blanket prevention)
Severity: medium

Jos asked to "prevent" adding a similar name. Blanket prevention is wrong here:
"Jeff Mills", "Jeff Mills & Robert Hood", "Jeff Mills & The Zanza 21" are similar
AND legitimately distinct. So:

- EXACT duplicate (case-insensitive, trimmed, "&"/"and" normalised): BLOCK. Back
  this with a normalised-name unique index at the DB level so it holds for imports
  too, not just the form.
- SIMILAR name: WARN, don't block. Show candidate matches with their product
  counts ("Jeff Mills — 28 products") and an "Add anyway" option. Human decides.
  Use Postgres pg_trgm similarity() for the candidate list (already on Postgres).

Acceptance: adding an exact-duplicate name is prevented with a clear message;
adding a merely similar name shows candidates and still allows an intentional add.

================================================================================
C. GENRES  (same pattern as artists — see screenshot: search "Darkcore",
separate empty "Add genre" field, "No matches")
================================================================================

## C1 — Carry the searched term into "add genre"
Severity: low (friction) — mirrors B1

The Genre UI has two separate fields: a search field and an empty "Add genre"
field. When search returns no match, the typed term (e.g. "Darkcore") should flow
into the add action instead of being retyped. Best: show an inline "Add
'Darkcore'" action right at the "No matches" point, pre-filled.

Acceptance: a no-match genre search offers a one-click add with the term
pre-filled.

## C2 — Confirmation on add
Severity: low — mirrors B2

Show a success confirmation after adding a genre.

## C3 — Clickable genres → genre view (ADMIN only)
Severity: low — mirrors A4

Genres are not clickable. Make a genre link to a page of all products in that
genre. Admin only, consistent with A4 (public site stays minimal); management
view, all products regardless of stock.

Acceptance: in admin, clicking a genre opens a list of its products.

## C4 — Duplicate validation (lighter than artists)
Severity: low — mirrors B3

Same two-tier idea, but genres are a small controlled vocabulary (72 rows), so
duplicate risk is far lower than the 55k-artist table. Exact (case-insensitive,
trimmed) match should block; a normalised-name unique index is cheap and worth
having. Fuzzy "did you mean" is optional here given the small set.

Acceptance: an exact-duplicate genre name is prevented; near-duplicates at most
warn.

================================================================================
D. PRODUCT TYPES  (same pattern again)
================================================================================

Same findings as artists/genres/labels, applied to Product Types:
- D1 carry the searched term into add (inline "Add '<term>'" at no-match) — cf B1/C1
- D2 success confirmation on add — cf B2/C2
- D3 clickable product type → admin view of its products (admin only) — cf A4/C3
- D4 exact-duplicate block + normalised-name unique index; small controlled
  vocabulary, so fuzzy "did you mean" optional — cf C4

Acceptance: product-type add carries the term and confirms; product types are
clickable to an admin product list; exact duplicates prevented.

================================================================================
SEPARATE, LARGER — not in this scope
================================================================================

## Merge existing duplicate artists
The legacy import already contains thousands of duplicate/variant artists (see the
"Jeff Mills" family). B3 only prevents NEW duplicates; it does not clean up
existing ones. That needs a merge tool: choose the canonical artist, repoint all
products from the duplicates to it, delete the duplicates. The "In use by N
products" counts are the input. This is the concrete form of the parked
"dup-unifier" idea and should be its own planned piece, post-launch.

================================================================================
CROSS-CUTTING
================================================================================
- All are admin mutations: keep requireAdmin() inside each handler; Gherkin
  coverage required; architectural ones (A1 initial-transaction-on-create, B3
  normalised unique index) through /code-review.
- A1 changes product-creation behaviour — watch mutation-test impact on that path.
- A2 may need a migration (reason column → nullable).
- B3's normalisation and the merge tool tie to the parked dup-unifier idea.
- Priority for pre-launch: A1 first (silent invisible products is a real trap for
  the shop operator). B1/B2/B3 next (artist entry is a constant operation). A2/A3/
  A4 and all of C (genres) are quality-of-life and can follow.
- B (artists), C (genres), D (product types) AND labels are the SAME
  add/confirm/click/dedupe pattern — four reference entities. Do NOT fix this four
  times. Build (or extend) one shared reference-entity component so the fix lands
  once across all of them. lib/reference-crud.ts already suggests a shared seam —
  start there. This is now the primary architectural decision in this spec: get
  the shared component right and B/C/D/labels all follow from it. Prime candidate
  for the new @code-reviewer agent to guard against divergence.
