# Admin credentials

The two admin accounts (shop owner + website builder) are seeded from the
**environment** — passwords are never hardcoded. `npm run db:seed` fails loudly
(before touching the database) if strong passwords aren't set, so a weak placeholder
can't ship by accident.

## Required environment variables

| Variable | Required | Notes |
|---|---|---|
| `SEED_ADMIN_SHOP_PASSWORD` | yes | Shop owner's initial password. Min 8 chars. |
| `SEED_ADMIN_DEV_PASSWORD` | yes | Website builder's initial password. Min 8 chars. |
| `SEED_ADMIN_SHOP_EMAIL` | no | Defaults to `shop@antenne-tilburg.nl`. |
| `SEED_ADMIN_DEV_EMAIL` | no | Defaults to `dev@antenne-tilburg.nl`. |

> **`.env.example` should list these variable names (no values).** Add them there and
> in your local `.env`. (They aren't added automatically — env files are outside the
> assistant's write permissions.)

## Newsletter email (Resend)

Sending the newsletter and the double opt-in confirmation emails uses
[Resend](https://resend.com).

| Variable | Required | Notes |
|---|---|---|
| `RESEND_API_KEY` | to send | Resend API key. Without it, sends throw and no email goes out. |
| `NEWSLETTER_FROM` | to send | Sender identity, e.g. `Antenne Tilburg <newsletter@antenne-tilburg.nl>`. The domain must be **verified in Resend** for delivery. |
| `NEXTAUTH_URL` | in prod | Already used elsewhere; also the base for confirm/unsubscribe links in emails. Falls back to `http://localhost:3000` in dev. |

Add these two lines to `.env.example` (names only) and set real values in `.env` /
the deployment environment:

```
RESEND_API_KEY=
NEWSLETTER_FROM=
```

Tests mock the sender, so the suite runs without either variable set.

## Seeding

1. Generate strong, unique passwords, e.g. `openssl rand -base64 18`.
2. Put them in `.env` (local) or the deployment environment (never commit real values):
   ```
   SEED_ADMIN_SHOP_PASSWORD=…
   SEED_ADMIN_DEV_PASSWORD=…
   ```
3. `npm run db:seed`. The admin upsert is idempotent on email, so re-running with new
   passwords rotates them.

## Credential handoff

- Set the real passwords in the **deployment environment**, not in the repo.
- After first login, each admin should change their own password via the Users admin
  at `/admin/settings/users` (email + password management already exists).
- **Before any real use, re-seed (or rotate) any environment that was seeded with the
  old `changeme123` placeholder** — including local dev databases created earlier.
- `.env` is gitignored; `.env.example` carries variable names only.

## Related

- Validation + resolution: `lib/seed-users.ts` (`resolveAdminSeedUsers`), tested in
  `lib/seed-users.test.ts`.
- Login verification: `lib/authorize.ts` (bcrypt). Admin API guard: `lib/api-auth.ts`
  (`requireAdmin` → `getServerSession`).
