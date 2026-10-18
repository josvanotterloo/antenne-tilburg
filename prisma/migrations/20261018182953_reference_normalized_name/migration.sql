-- Non-unique lookup column for app-level near-duplicate blocking
-- (lib/reference-dedupe.ts). NOT a unique constraint — existing data
-- already has case-variant duplicates ("Jeff Mills" / "JEFF MILLS") that
-- would fail a unique index; adding one is a parked follow-up task
-- (tasks/todo.md Backlog) once that data is merged.
--
-- Hand-trimmed: `prisma migrate dev --create-only` also proposed dropping
-- every trigram index and the search_vector GENERATED column's default,
-- none of which are modeled in schema.prisma (same drift every migration in
-- this repo hits — see tasks/lessons.md 2026-07-08/2026-07-17/2026-07-29b).
-- Those lines are discarded here.
--
-- Defaults to '' only as a placeholder until
-- scripts/backfill-normalized-names.ts runs — every row ends up with its
-- real normalized name, computed by the same lib/reference-dedupe.ts
-- function the app uses going forward (no SQL reimplementation of the
-- normalizer, so there's no drift risk between backfilled and future rows).
ALTER TABLE "Artist" ADD COLUMN     "normalizedName" TEXT NOT NULL DEFAULT '';

ALTER TABLE "Genre" ADD COLUMN     "normalizedName" TEXT NOT NULL DEFAULT '';

ALTER TABLE "Label" ADD COLUMN     "normalizedName" TEXT NOT NULL DEFAULT '';

ALTER TABLE "ProductType" ADD COLUMN     "normalizedName" TEXT NOT NULL DEFAULT '';

CREATE INDEX "Artist_normalizedName_idx" ON "Artist"("normalizedName");

CREATE INDEX "Genre_normalizedName_idx" ON "Genre"("normalizedName");

CREATE INDEX "Label_normalizedName_idx" ON "Label"("normalizedName");

CREATE INDEX "ProductType_normalizedName_idx" ON "ProductType"("normalizedName");
