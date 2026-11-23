# Go-live checklist

The single list for what gates launch. Supersedes any go-live item
numbering in `docs/qa/` (see `go-live-persistence-note.md`, now outdated).

## Infrastructure
1. [ ] Hetzner VPS, Ubuntu 24.04, ~€8/month, automatic backups.
2. [ ] Cloudflare zone for `antenne-tilburg.nl` + nameserver switch. Do not
       point the A record at the VPS until the chain check passes.
3. [ ] Termius and Tailscale on laptop and phone.
4. [ ] Lock down the VPS: SSH keys only, port 443 from Cloudflare IPs only,
       no public SSH.
5. [ ] Backups — set up before anything else on the server: nightly,
       covering the database dump, `data/`, and the uploads directory.
       Destination must be private, never the public repo.
6. [ ] Caddy with the Cloudflare DNS plugin.
7. [ ] tmux and Claude Code on the VPS. Decide on
       `permissions.denyInsteadOfPrompting` vs. `--permission-prompts none`
       for unattended sessions, after reading the two unread settings
       sections. Not for laptop sessions.
8. [ ] Handover CLAUDE.md on the server.

## Uploads
- [ ] Decide where uploads live before deploy. Default: a persistent
      directory outside the release folder, served by Caddy, with the app
      writing to it. Object Storage stays on the backlog. Depends on the
      result of the read-only check of runtime files in `public/`.

## Security scan
- [ ] Run Strix remotely, after the VPS, Caddy, and a first deploy exist —
      with its own scratch database and throwaway admins. Never against
      production data. Open: which server, and where the model comes from.

## Application
- [ ] Production env vars: `RESEND_API_KEY`,
      `NEWSLETTER_FROM=newsletter@antenne-tilburg.nl`,
      `EMAIL_ENCRYPTION_KEY`, `SENTRY_DSN` (set at build time),
      `SENTRY_AUTH_TOKEN`.
- [ ] Deploy, migrate, seed — with real admin passwords.
- [ ] Verify the Cloudflare → Caddy → app chain.

## Data
- [ ] Legacy migration against the production database.
- [ ] Subscriber email encryption backfill.
- [ ] Copy blog images into the uploads directory.
- [ ] `customer-orders.md` stays a file for launch — revisit moving it into
      the database if an edit is ever lost.

## Verify and hand over
- [ ] Confirm a newsletter send works end to end.
- [ ] Tell DJ DMDN the support path (text or call Jos).

## Proposed, not yet decided
- [ ] DYMO print mode from the VPS — the print route calls
      `localhost:41951`; DYMO Connect runs on the shop computer. Open:
      paper ID 99012, and the GET-trigger question.
- [ ] Fresh legacy dump + a rerun at cutover.
- [ ] SEO pass + 301 redirects from the old URLs.
- [ ] Custom 404 page before launch.
