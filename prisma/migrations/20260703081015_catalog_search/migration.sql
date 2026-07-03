-- Full-text search: generated STORED tsvector over artist + title + description.
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "search_vector" tsvector
  GENERATED ALWAYS AS (
    to_tsvector(
      'english',
      coalesce(artist, '') || ' ' || coalesce(title, '') || ' ' || coalesce(description, '')
    )
  ) STORED;

CREATE INDEX IF NOT EXISTS product_search_idx ON "Product" USING GIN(search_vector);

-- CreateIndex
CREATE INDEX "Product_condition_idx" ON "Product"("condition");

-- CreateIndex
CREATE INDEX "Product_inStock_idx" ON "Product"("inStock");

-- CreateIndex
CREATE INDEX "Product_createdAt_idx" ON "Product"("createdAt");
