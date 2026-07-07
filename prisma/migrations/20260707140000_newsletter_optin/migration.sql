-- Double opt-in for newsletter subscribers.

-- CreateEnum
CREATE TYPE "SubscriberStatus" AS ENUM ('PENDING', 'CONFIRMED');

-- AlterTable: add status. Backfill existing rows as CONFIRMED (they opted in under
-- the old single-step flow), then switch the default to PENDING for new signups.
ALTER TABLE "NewsletterSubscriber"
  ADD COLUMN "status" "SubscriberStatus" NOT NULL DEFAULT 'CONFIRMED';
ALTER TABLE "NewsletterSubscriber"
  ALTER COLUMN "status" SET DEFAULT 'PENDING';

-- AlterTable: add confirmToken. Backfill existing rows with a random 64-char hex
-- token (two md5 hashes concatenated), then enforce NOT NULL + uniqueness.
ALTER TABLE "NewsletterSubscriber" ADD COLUMN "confirmToken" TEXT;
UPDATE "NewsletterSubscriber"
  SET "confirmToken" = md5(random()::text || id) || md5(clock_timestamp()::text || id)
  WHERE "confirmToken" IS NULL;
ALTER TABLE "NewsletterSubscriber" ALTER COLUMN "confirmToken" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "NewsletterSubscriber_confirmToken_key"
  ON "NewsletterSubscriber"("confirmToken");
