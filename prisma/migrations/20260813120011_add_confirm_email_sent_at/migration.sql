-- AlterTable
ALTER TABLE "NewsletterSubscriber" ADD COLUMN     "confirmEmailSentAt" TIMESTAMP(3);

-- Backfill: every existing PENDING row already had a signup-time send
-- attempt before this column existed, and we can't know in hindsight
-- whether it actually succeeded. Treating it as sent (rather than leaving
-- it null) avoids the new retry queue blasting a duplicate confirmation
-- email to every already-pending subscriber the first time an admin runs
-- it — a worse outcome than occasionally missing a genuinely-failed old
-- send, which the subscriber can always resolve by signing up again.
-- CONFIRMED rows are unaffected either way (the retry query only looks at
-- PENDING rows).
UPDATE "NewsletterSubscriber" SET "confirmEmailSentAt" = "createdAt" WHERE "status" = 'PENDING';
