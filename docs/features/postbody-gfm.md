# PostBody: GFM task lists and autolink (CO1)

`components/PostBody.tsx` is the single shared markdown renderer for the
public blog post page (`app/(public)/blog/[slug]/page.tsx`) and the
customer-orders editor preview (`components/admin/CustomerOrdersEditor.tsx`).

Added `remark-gfm` (`remarkPlugins={[remarkGfm]}`) so:

- `- [ ]` / `- [x]` renders as a real, disabled `<input type="checkbox">`,
  checked state preserved.
- Bare `https://` URLs autolink (same `a` component override already
  handled styling, no change needed there).

A new `li` component override drops the bullet/indent only for a GFM
task-list item (`className?.includes("task-list-item")`) — without it, a
task item showed both the `<ul>`'s bullet and the checkbox. Ordinary list
items are unaffected (no `className`, same as before this change).

No changes needed in either call site — this is entirely a `PostBody.tsx`
change, since both already rendered through it.

remark-gfm also enables GFM tables, strikethrough, and footnotes as a
side effect of the single plugin; these have no custom styling or test
coverage yet (not requested, not blocking — plain rendering via
react-markdown's defaults).
