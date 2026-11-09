# Instruction: Windows test-laptop setup

One-time setup for a Windows test laptop (e.g. DMDN's) that only ever pulls
and runs the app locally — never pushes, never commits. Do this once, in
person, on the laptop.

## Install

- [Git for Windows](https://git-scm.com/download/win)
- [Node.js LTS](https://nodejs.org/)
- PostgreSQL via the [EDB installer](https://www.postgresql.org/download/windows/)
  — let it install as a Windows service (default option) so it starts
  automatically with the machine.

## Read-only deploy key

The laptop only pulls, so it gets a deploy key scoped to read-only — not a
personal GitHub account.

1. In PowerShell or Git Bash:
   ```
   ssh-keygen -t ed25519 -N "" -f $HOME\.ssh\antenne-tilburg-deploy
   ```
   (no passphrase — this key only needs to work unattended when the laptop
   boots `start-dev.bat`)
2. Add the **public** key (`antenne-tilburg-deploy.pub`) as a Deploy key on
   this repo: GitHub → repo → Settings → Deploy keys → Add deploy key.
   Leave "Allow write access" **unchecked**.
3. Add a `Host` alias to `~/.ssh/config` so git uses that key for this repo
   specifically, without touching any other SSH config on the laptop:
   ```
   Host antenne-tilburg-deploy
     HostName github.com
     User git
     IdentityFile ~/.ssh/antenne-tilburg-deploy
     IdentitiesOnly yes
   ```
4. Clone via the alias, not the normal `github.com` host:
   ```
   git clone antenne-tilburg-deploy:josvanotterloo/antenne-tilburg.git
   ```

## Local `.env`

Copy `.env.example` to `.env` in the repo root and fill in:

- `DATABASE_URL` — point at the local PostgreSQL service (e.g.
  `postgresql://postgres:<password>@localhost:5432/antenne_dev`).
- `NEXTAUTH_SECRET` — any locally-generated value (`openssl rand -hex 32`,
  or an online equivalent — doesn't need to match any other environment's).
- `NEXTAUTH_URL` — `http://localhost:3000`.
- `EMAIL_ENCRYPTION_KEY` — `openssl rand -hex 32`; see
  `docs/features/email-encryption-at-rest.md`. Required for the app to
  start even in this throwaway environment.
- `SEED_ADMIN_SHOP_PASSWORD` / `SEED_ADMIN_DEV_PASSWORD` — any local values,
  min 8 chars; see `docs/instructions/admin-credentials.md`. Only used by
  the one-time seed step below.
- `RESEND_API_KEY` / `SENTRY_DSN` — **leave both unset.** The app runs fine
  without them: newsletter sending is simply unavailable, and Sentry's own
  init code no-ops when `SENTRY_DSN` is empty (`lib/sentry-init-options.ts`).

`.env` is already covered by the repo's `.gitignore` (`.env` and
`.env*.local`) — confirm it stays untracked (`git status` should never list
it) rather than re-verifying the `.gitignore` rule itself each time.

## One-time setup

From the repo root, after cloning:

```
npm install
npx prisma migrate deploy
npm run db:seed
```

Use `npx prisma migrate deploy`, not `npm run prisma:migrate` — the latter
runs `prisma migrate dev`, which can prompt interactively and tries to
author a new migration on drift. `migrate deploy` only applies migrations
that already exist in `prisma/migrations/`, which is exactly what a laptop
that never authors schema changes needs.

## Every time

Double-click the desktop shortcut to `scripts\start-dev.bat`. It pulls the
latest commit, updates dependencies and the database, starts the dev
server, and opens the browser automatically. Leave its window open while
testing; closing it stops the server.

## Notes

- The deploy key and `.env` live only on this laptop. Neither is ever
  committed, pushed, or needed on any other machine.
- If `start-dev.bat` ever reports a pull failure or a setup error, it tells
  whoever's testing to call or screenshot-and-send to Jos — no further
  Windows-specific troubleshooting is expected of them.
