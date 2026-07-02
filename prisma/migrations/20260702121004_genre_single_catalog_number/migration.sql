/*
  Warnings:

  - You are about to drop the `_ProductGenres` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `genreId` to the `Product` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "_ProductGenres" DROP CONSTRAINT "_ProductGenres_A_fkey";

-- DropForeignKey
ALTER TABLE "_ProductGenres" DROP CONSTRAINT "_ProductGenres_B_fkey";

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "catalogNumber" TEXT,
ADD COLUMN     "genreId" TEXT NOT NULL;

-- DropTable
DROP TABLE "_ProductGenres";

-- CreateIndex
CREATE INDEX "Product_genreId_idx" ON "Product"("genreId");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_genreId_fkey" FOREIGN KEY ("genreId") REFERENCES "Genre"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
