-- Stock quantity tracking. inStock is now derived from quantity (> 0), kept in sync.

-- AlterTable: add quantity, defaulting to 0 (out of stock).
ALTER TABLE "Product" ADD COLUMN "quantity" INTEGER NOT NULL DEFAULT 0;

-- Backfill: in-stock rows become quantity 1; out-of-stock rows keep the 0 default.
UPDATE "Product" SET "quantity" = 1 WHERE "inStock" = true;
