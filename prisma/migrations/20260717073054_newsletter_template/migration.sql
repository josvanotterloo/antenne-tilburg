-- Newsletter template singleton (reusable header/footer between sends).
-- Hand-trimmed: prisma migrate dev's auto-diff also tried to drop the
-- manually-migrated FTS/trigram indexes and alter the generated
-- search_vector column (drift against catalog_fuzzy_search); only the
-- CreateTable belongs in this migration.
CREATE TABLE "NewsletterTemplate" (
    "id" TEXT NOT NULL,
    "headerText" TEXT NOT NULL,
    "footerText" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NewsletterTemplate_pkey" PRIMARY KEY ("id")
);
