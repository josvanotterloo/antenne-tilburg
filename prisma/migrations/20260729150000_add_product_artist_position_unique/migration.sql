-- Guards "position 0 = primary artist" at the DB level: without this,
-- nothing prevents two ProductArtist rows for the same product both at
-- position 0 (or any other duplicate position) from a future write path
-- that doesn't go through lib/product-input.ts's array-index assignment.
-- Hand-written (interactive-only "migrate dev" refuses non-interactively
-- for any warning, including a safe additive unique constraint), applied
-- via `prisma migrate deploy`.
CREATE UNIQUE INDEX "ProductArtist_productId_position_key" ON "ProductArtist"("productId", "position");
