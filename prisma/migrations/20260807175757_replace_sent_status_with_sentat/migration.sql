-- Replace SupplyOrderStatus.SENT with SupplyOrder.sentAt (DateTime?).
--
-- "Sent" and "how much has arrived" are independent facts that were
-- incorrectly forced into one status column: a partial receive silently
-- cleared SENT because the receive route always overwrote `status`. See
-- docs/features/order-transaction-redesign.md.
--
-- Verified zero SupplyOrder rows with status = 'SENT' in the dev DB before
-- writing this migration, so no defensive UPDATE/backfill is needed here.

-- Recreate the enum without SENT (Postgres has no ALTER TYPE ... DROP VALUE)
ALTER TYPE "SupplyOrderStatus" RENAME TO "SupplyOrderStatus_old";
CREATE TYPE "SupplyOrderStatus" AS ENUM ('PENDING', 'PARTIAL', 'RECEIVED');
ALTER TABLE "SupplyOrder" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "SupplyOrder" ALTER COLUMN "status" TYPE "SupplyOrderStatus" USING ("status"::text::"SupplyOrderStatus");
ALTER TABLE "SupplyOrder" ALTER COLUMN "status" SET DEFAULT 'PENDING';
DROP TYPE "SupplyOrderStatus_old";

-- New sentAt column
ALTER TABLE "SupplyOrder" ADD COLUMN "sentAt" TIMESTAMP(3);
