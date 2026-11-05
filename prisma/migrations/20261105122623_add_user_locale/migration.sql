-- CreateEnum
CREATE TYPE "AdminLocale" AS ENUM ('NL', 'EN');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "locale" "AdminLocale" NOT NULL DEFAULT 'NL';
