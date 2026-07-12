# Admin dark theme (design touch-up, branch 3/3)

**Status:** branch `feature/admin-dark-theme` — merged to `master` (2026-07-12).

Reskinned the admin from the default light Tailwind theme to a considered dark
theme — a professional workspace, distinct from the public storefront. No logic,
layout, or component-structure changes: same pages, same nav, same flows, just
reskinned. Verified live end-to-end in the browser.

## Tokens (DESIGN.md §7)
Added to `tailwind.config.ts` and documented in DESIGN.md (frontmatter + new §7):
`admin-bg #111318`, `admin-surface #1C1F26`, `admin-raised #242833`,
`admin-hairline #2A2D35`, `admin-ink #F0F0F0`, `admin-ink-muted #8A8F9C`.
`admin-raised` is the one addition beyond the brief's five — needed for hover /
active / secondary-badge states (product register requires full interaction
states); documented as such.

## Approach
- **`.admin-dark` base** (`globals.css`, scoped to the admin layout wrapper so it
  never touches the public `.site-dark` surface): `color-scheme: dark` (renders
  native date/time pickers, checkboxes, scrollbars dark — the detail that
  separates a considered tool from a default form), dark fill + muted
  placeholders for `input`/`textarea`/`select`, and the shared Signal focus ring.
- **Systematic token map** across all 27 admin surfaces via a scripted
  neutral/white/semantic → admin-token replacement (grep-verified: zero light
  classes remain). Semantic badges dark-adapted (CONFIRMED/NEW green tint,
  PENDING amber tint, danger red-400). Primary buttons became the light-on-dark
  inversion (`admin-ink` fill) with a Signal hover.
- **AdminTopNav** hand-rewritten as dark tool chrome (surface bar, hairline
  bottom, active-section on the raised tone, muted inactive items).

## Tests & verification
- 416 tests green (no new — styling only). `tsc`, lint, `next build` clean.
- Contrast (WCAG AA): ink 17:1, ink-muted ~5.0–5.5:1, danger red ~5.9:1 — all
  body/label text clears 4.5:1 on its background.
- **Live browser check** (prod build, authenticated by the shop owner): login,
  catalog (nav + sub-nav, table hairlines, green/secondary badges, danger red,
  primary + ghost + search), notice form (recessed textarea, **native checkbox
  and datetime pickers rendering dark**, muted helper text), and the product
  form (text inputs, Combobox input + floating dark dropdown + Signal focus
  ring, condition toggle active/inactive). Every reskinned element type reads
  cleanly on dark.
- `/code-review low`: no findings.

## Notes
- The admin keeps its subtle rounded corners and proportional UI font — it is a
  form-dense tool, not the terminal-true storefront (documented in §7).
- `components/ui/Placeholder.tsx` (only on the legacy `/admin/posts` route) uses
  the near-identical public `ink`/`ink-muted` tokens; reads fine on dark, left
  untouched to avoid changing a shared component for an imperceptible delta.
