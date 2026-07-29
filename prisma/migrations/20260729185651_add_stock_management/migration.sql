-- CreateEnum
CREATE TYPE "SupplyOrderStatus" AS ENUM ('PENDING', 'PARTIAL', 'RECEIVED');

-- CreateEnum
CREATE TYPE "StockTransactionType" AS ENUM ('IN', 'OUT', 'ADJUSTMENT');

-- AlterTable
ALTER TABLE "Product" ALTER COLUMN "inStock" SET DEFAULT false;

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contact" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplyOrder" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "reference" TEXT,
    "notes" TEXT,
    "orderedAt" TIMESTAMP(3) NOT NULL,
    "receivedAt" TIMESTAMP(3),
    "status" "SupplyOrderStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplyOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplyOrderLine" (
    "id" TEXT NOT NULL,
    "supplyOrderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantityOrdered" INTEGER NOT NULL,
    "quantityReceived" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplyOrderLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockTransaction" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "type" "StockTransactionType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "note" TEXT,
    "supplyOrderLineId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_name_key" ON "Supplier"("name");

-- CreateIndex
CREATE INDEX "SupplyOrder_supplierId_idx" ON "SupplyOrder"("supplierId");

-- CreateIndex
CREATE INDEX "SupplyOrder_status_idx" ON "SupplyOrder"("status");

-- CreateIndex
CREATE INDEX "SupplyOrderLine_productId_idx" ON "SupplyOrderLine"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "SupplyOrderLine_supplyOrderId_productId_key" ON "SupplyOrderLine"("supplyOrderId", "productId");

-- CreateIndex
CREATE INDEX "StockTransaction_productId_createdAt_idx" ON "StockTransaction"("productId", "createdAt");

-- CreateIndex
CREATE INDEX "StockTransaction_supplyOrderLineId_idx" ON "StockTransaction"("supplyOrderLineId");

-- AddForeignKey
ALTER TABLE "SupplyOrder" ADD CONSTRAINT "SupplyOrder_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplyOrderLine" ADD CONSTRAINT "SupplyOrderLine_supplyOrderId_fkey" FOREIGN KEY ("supplyOrderId") REFERENCES "SupplyOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplyOrderLine" ADD CONSTRAINT "SupplyOrderLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransaction" ADD CONSTRAINT "StockTransaction_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransaction" ADD CONSTRAINT "StockTransaction_supplyOrderLineId_fkey" FOREIGN KEY ("supplyOrderLineId") REFERENCES "SupplyOrderLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;
