# Go-live note — filesystem state is not in the backup story

> **OUTDATED, read only.** The "go-live checklist item 10"/"item 16"
> references below are to a numbered list that no longer exists as such.
> The actual go-live list is now `docs/go-live-checklist.md` — the backup
> gap this note raised is covered there (Infrastructure #5: nightly
> backups covering `data/` and the uploads directory, destination
> private; Data: blog image migration; Data: `customer-orders.md` stays a
> file for launch).

Surfaced during Round 2 (customer-orders investigation), 15 Oct 2026. This is an
operational gap, not a code defect. Resolve before go-live.

## The gap
Some operational state lives on the server FILESYSTEM, not in the database or git,
so neither a database backup nor the planned nightly git backup (go-live checklist
item 10) captures it. On a VPS rebuild, a bad redeploy, or disk loss, this data is
gone.

Affected paths:
- `data/customer-orders.md` — the customer-orders content (a single gitignored
  markdown file; the whole "Customer Orders" admin feature is this one file).
- `public/uploads/` — uploaded images (blog covers, product images). Already known
  via the parked "Hetzner Object Storage for uploads" backlog item; this reframes
  it as also a BACKUP issue, not only a serving/deploy issue.

## Why it matters
- `customer-orders.md` is the shop's only record of customer special-orders. Losing
  it silently on a rebuild is a real operational loss with no recovery.
- `public/uploads/` holds the blog images you still have to migrate from the old
  server (checklist item 16) plus any new uploads. Runtime-written files under
  `public/` also don't survive a redeploy of a fresh build — they must live
  somewhere durable.

## Options (decide before launch)
1. Make the nightly backup explicitly include these filesystem paths
   (`data/` and `public/uploads/`), not just the DB and git. Simplest.
2. Move uploads to Hetzner Object Storage (the parked item) — solves serving,
   deploy-survival, AND backup in one move. Preferred for uploads long-term.
3. Consider moving `customer-orders.md` content into the database, so it's covered
   by DB backups and gains history — optional; a notepad-in-the-DB is fine too, the
   point is that it must be backed up.

## Minor, related
`customer-orders.md` is read/written as one blob, overwritten wholesale
(last-write-wins). With two admins the risk of a lost edit is low, but worth
knowing. The atomic write-then-rename prevents corruption, not concurrent-edit
loss.

## Ties to existing items
- Go-live checklist item 10 (nightly backup) — must cover filesystem state.
- Go-live checklist item 16 (blog image migration) — those files land in
  `public/uploads/`, so this is where they live and must be backed up.
- Backlog: Hetzner Object Storage for uploads.

## Action
Before go-live: decide how server-side filesystem state (`data/`,
`public/uploads/`) is backed up and survives redeploys. This is a prerequisite for
trusting the backup story, not a nice-to-have.
