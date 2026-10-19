import { describe, expect, it } from "vitest";

import { cleanMigrationSql } from "./clean-migration";

describe("cleanMigrationSql", () => {
  it("strips a spurious trigram-index drop, keeping its header comment removed too", () => {
    const sql = [
      "-- AlterTable",
      'ALTER TABLE "Artist" ADD COLUMN "normalizedName" TEXT NOT NULL DEFAULT \'\';',
      "",
      "-- DropIndex",
      'DROP INDEX "product_artist_trgm_idx";',
      "",
      "-- CreateIndex",
      'CREATE INDEX "Artist_normalizedName_idx" ON "Artist"("normalizedName");',
    ].join("\n");

    const { cleaned, strippedBlocks } = cleanMigrationSql(sql);

    expect(cleaned).toContain('ADD COLUMN "normalizedName"');
    expect(cleaned).toContain('CREATE INDEX "Artist_normalizedName_idx"');
    expect(cleaned).not.toContain("product_artist_trgm_idx");
    expect(cleaned).not.toContain("-- DropIndex");
    expect(strippedBlocks).toHaveLength(1);
    expect(strippedBlocks[0]).toContain("product_artist_trgm_idx");
  });

  it("strips a search_vector DROP DEFAULT on a table other than Product", () => {
    const sql = [
      "-- AlterTable",
      'ALTER TABLE "Genre" ALTER COLUMN "search_vector" DROP DEFAULT;',
      "",
      "-- CreateIndex",
      'CREATE INDEX "Genre_normalizedName_idx" ON "Genre"("normalizedName");',
    ].join("\n");

    const { cleaned, strippedBlocks } = cleanMigrationSql(sql);

    expect(cleaned).not.toContain("search_vector");
    expect(cleaned).toContain("Genre_normalizedName_idx");
    expect(strippedBlocks).toHaveLength(1);
  });

  it("does not strip a line where the spurious statement is only a trailing suffix", () => {
    const sql = [
      '-- see also DROP INDEX "product_search_idx";',
      'CREATE INDEX "Label_normalizedName_idx" ON "Label"("normalizedName");',
    ].join("\n");

    const { cleaned, strippedBlocks } = cleanMigrationSql(sql);

    expect(cleaned).toBe(sql);
    expect(strippedBlocks).toHaveLength(0);
  });

  it("does not strip a line where the spurious statement is only a leading prefix", () => {
    const sql = [
      'DROP INDEX "product_search_idx"; -- kept for a reason, not raw drift',
      'CREATE INDEX "Label_normalizedName_idx" ON "Label"("normalizedName");',
    ].join("\n");

    const { cleaned, strippedBlocks } = cleanMigrationSql(sql);

    expect(cleaned).toBe(sql);
    expect(strippedBlocks).toHaveLength(0);
  });

  it("strips a spurious line even when it carries leading/trailing whitespace", () => {
    const sql = [
      "-- DropIndex",
      '  DROP INDEX "product_search_idx";  ',
      "",
      "-- CreateIndex",
      'CREATE INDEX "Label_normalizedName_idx" ON "Label"("normalizedName");',
    ].join("\n");

    const { cleaned, strippedBlocks } = cleanMigrationSql(sql);

    expect(cleaned).not.toContain("product_search_idx");
    expect(cleaned).toContain("Label_normalizedName_idx");
    expect(strippedBlocks).toHaveLength(1);
  });

  it("strips the search_vector DROP DEFAULT statement", () => {
    const sql = [
      "-- AlterTable",
      'ALTER TABLE "Product" ALTER COLUMN "search_vector" DROP DEFAULT;',
      "",
      "-- CreateIndex",
      'CREATE INDEX "Product_createdAt_idx" ON "Product"("createdAt");',
    ].join("\n");

    const { cleaned, strippedBlocks } = cleanMigrationSql(sql);

    expect(cleaned).not.toContain("search_vector");
    expect(cleaned).toContain("Product_createdAt_idx");
    expect(strippedBlocks).toHaveLength(1);
  });

  it("strips a product_search_idx drop even without a trgm suffix", () => {
    const sql = [
      "-- DropIndex",
      'DROP INDEX "product_search_idx";',
      "",
      "-- CreateIndex",
      'CREATE INDEX "Label_normalizedName_idx" ON "Label"("normalizedName");',
    ].join("\n");

    const { cleaned, strippedBlocks } = cleanMigrationSql(sql);

    expect(cleaned).not.toContain("product_search_idx");
    expect(cleaned).toContain("Label_normalizedName_idx");
    expect(strippedBlocks).toHaveLength(1);
  });

  it("leaves a migration with no known-spurious lines completely untouched", () => {
    const sql = [
      "-- AlterTable",
      'ALTER TABLE "Label" ADD COLUMN "normalizedName" TEXT NOT NULL DEFAULT \'\';',
      "",
      "-- CreateIndex",
      'CREATE INDEX "Label_normalizedName_idx" ON "Label"("normalizedName");',
    ].join("\n");

    const { cleaned, strippedBlocks } = cleanMigrationSql(sql);

    expect(cleaned).toBe(sql);
    expect(strippedBlocks).toHaveLength(0);
  });

  it("does not strip a legitimate index drop that merely mentions trgm in a comment", () => {
    const sql = [
      "-- This renames an unrelated index, trgm is just mentioned here",
      'DROP INDEX "old_artist_name_idx";',
      "",
      "-- CreateIndex",
      'CREATE INDEX "artist_name_idx" ON "Artist"("name");',
    ].join("\n");

    const { cleaned, strippedBlocks } = cleanMigrationSql(sql);

    expect(cleaned).toBe(sql);
    expect(strippedBlocks).toHaveLength(0);
  });
});
