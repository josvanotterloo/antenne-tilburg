-- Encrypt subscriber emails at rest (see lib/email-crypto.ts).
--
-- The plaintext-unique constraint on "email" is replaced by a unique keyed
-- hash column ("emailHash", HMAC-SHA-256): the "email" column will hold
-- AES-256-GCM ciphertext, which is non-deterministic (fresh IV per row), so a
-- unique index on it can no longer provide duplicate detection.
--
-- "emailHash" stays nullable: rows created before this migration still hold
-- plaintext in "email" and NULL here, until the one-time backfill
-- (scripts/encrypt-subscriber-emails.ts) encrypts them — encryption needs
-- EMAIL_ENCRYPTION_KEY, which SQL has no access to.

-- DropIndex
DROP INDEX "NewsletterSubscriber_email_key";

-- AlterTable
ALTER TABLE "NewsletterSubscriber" ADD COLUMN "emailHash" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "NewsletterSubscriber_emailHash_key"
  ON "NewsletterSubscriber"("emailHash");
