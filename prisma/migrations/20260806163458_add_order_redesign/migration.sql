-- AlterEnum
ALTER TYPE "SupplyOrderStatus" ADD VALUE 'SENT' BEFORE 'PARTIAL';

-- AlterTable
ALTER TABLE "Label" ADD COLUMN     "supplierId" TEXT;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "supplierId" TEXT;

-- CreateIndex
CREATE INDEX "Label_supplierId_idx" ON "Label"("supplierId");

-- CreateIndex
CREATE INDEX "Product_supplierId_idx" ON "Product"("supplierId");

-- AddForeignKey
ALTER TABLE "Label" ADD CONSTRAINT "Label_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
