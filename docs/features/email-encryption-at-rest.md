# Email encryption at rest (newsletter subscribers)

**Status:** branch `feature/email-encryption-at-rest` — merged to `master` (2026-07-09).

## Summary
`NewsletterSubscriber.email` is now stored as AES-256-GCM ciphertext; a keyed
HMAC-SHA-256 hash column (`emailHash`, unique) provides duplicate detection at
signup. Closes OWASP audit finding #3 (`docs/security/owasp-audit-2026-07-09.md`).

## Design
- **`lib/email-crypto.ts`** — `encryptEmail` / `decryptEmail` / `emailHash`.
  - Stored format `v1:<iv>:<ciphertext>:<tag>` (base64), fresh 12-byte IV per
    encryption; the version prefix supports future rotation.
  - Values without the `v1:` prefix are legacy plaintext and pass through
    `decryptEmail` unchanged, so unmigrated rows never break reads.
  - Hash is **HMAC**-SHA-256 (keyed), not plain SHA-256: emails are low-entropy,
    so an unkeyed hash would be reversible by wordlist from a DB dump.
  - Key: `EMAIL_ENCRYPTION_KEY`, 64 hex chars (`openssl rand -hex 32`), read
    lazily per call. **Losing the key makes the mailing list unrecoverable.**
- **Schema** (`20260709100000_subscriber_email_encryption`): unique moved from
  `email` (ciphertext is non-deterministic) to nullable `emailHash`.
- **Touch points:** signup encrypts + hashes (dup → same non-enumerating 201 via
  P2002 on the hash); send decrypts per recipient and logs failures by
  subscriber **id** (PII out of logs — audit finding #9); admin list + CSV
  export decrypt for display; confirm/unsubscribe/delete are token/id-based and
  unchanged.
- **Backfill:** `scripts/encrypt-subscriber-emails.ts`
  (`npx tsx --env-file=.env scripts/encrypt-subscriber-emails.ts`) — idempotent;
  case-variant duplicate rows are reported by id and left for manual resolution.
  Run once at deploy, after setting the key.

## Tests & verification
- 349 tests green (18 new: crypto round-trip/tamper/wrong-key/legacy-fallback,
  keyed-hash properties, signup ciphertext+hash, send decryption + id-only
  logging, admin list/export decryption incl. legacy rows, backfill
  idempotency + conflict handling). `tsc`, lint clean.
- **Live against Postgres:** migration applied; the 2 real legacy dev rows
  migrated (`2 migrated, 0 already encrypted`), re-run reported
  `0 migrated, 2 already encrypted`, and stored ciphertext decrypted back to
  valid addresses with the live key.

## Operational notes
- `EMAIL_ENCRYPTION_KEY` is required in every environment that reads or writes
  subscribers. Back the key up separately from DB backups (a backup without the
  key is a mailing list you cannot email).
- Key rotation path: introduce `v2:` alongside a new env var, re-encrypt via a
  variant of the backfill script.
