# Antenne — manual QA checklist

> **OUTDATED, read only.** Items 11, 16, and 19 are fixed in current code
> despite their `[!]` status here — see `tasks/todo.md`'s QA backlog for
> what's still genuinely open. Do not update this file's checkboxes; file
> new findings elsewhere.

Run against your NORMAL dev setup (real dev DB, working RESEND_API_KEY,
`npm run dev`) — not the Strix scratch instance. Stop the Strix server first so
they don't fight over port 3000.

Status key: [ ] open · [~] partial · [x] passed · [!] issue found (logged)

## Public — anonymous
- [x] 1. Home / New Arrivals loads; table shows records. (100-cap confirmed)
- [ ] 2. Sort each column (Type, Artist, Title, Label) — order changes and holds.
         Check it sorts within the 100-cap, not just the visible page.
- [~] 3. Open a blog post; text renders fully. (Images blocked on cover-image
         migration = go-live item 16. Upload path tested → qa-findings-blog-images.md)
- [ ] 4. About, FAQ, Visit load; Visit shows current opening hours + any active notice.
- [ ] 5. Newsletter subscribe with a fresh @example.com → "check your email" →
         confirmation email arrives → confirm link works. (Needs live RESEND key.)
- [ ] 6. Unsubscribe link from that email works.
- [!] 7. 404: should be a styled not-found with a link home. FOUND: it's the bare
         Next.js default — needs a custom app/not-found.tsx. (Not yet in a file.)

## Admin — auth
- [x] 8. /admin while logged out → redirects to login. (Confirmed live: 307 → login)
- [x] 9. Log in with a real admin → lands in admin.
- [ ] 10. Log in with a wrong password → rejected cleanly.

## Admin — core CRUD (spot-check)
- [!] 11. Products: create, edit, list, appears on public site. FOUND: new products
          invisible until a stock transaction exists → spec A1.
- [ ] 12. Product stock: adjust quantity; ledger/quantity reflects it. (See spec A2/A3.)
- [!] 13. Blog post: create draft, add cover image, publish. Tested → blog-images findings.
- [ ] 14. Notice: create one; shows on the Visit page.
- [ ] 15. Opening hours: edit a day; change shows publicly.
- [!] 16. Reference entities (Label / Artist / Genre / Product Type): create, edit,
          delete. FOUND: add-term not carried, no confirmation, not clickable,
          no dedupe → spec B/C/D + labels.
- [ ] 17. Users: the two seed admins listed; create a third.

## Admin — newsletter
- [ ] 18. Subscribers list (/admin/settings/subscribers) shows your confirmed test
          address from step 5.
- [!] 19. Compose newsletter + Preview. FOUND: preview ≠ sent email (line breaks,
          links) → qa-findings-newsletter.md N5.
- [ ] 20. Send to the single test subscriber — "sent to 1", email arrives.

## Cross-cutting
- [ ] 21. Public site on a phone (or DevTools narrow) — usable, table readable.
- [ ] 22. A form validation error (submit an incomplete product) — clear message,
          no crash.

## Findings pile so far
- qa-findings-blog-images.md
- qa-findings-newsletter.md
- spec-admin-stock-artist.md  (artists/genres/labels/product types + stock)
- code-reviewer.md  (deliverable: subagent definition)
- Not yet filed: custom 404 (item 7)
