-- Marketplace listing flags and external IDs (Coworker.com / LiquidSpace)
ALTER TABLE "spaces" ADD COLUMN IF NOT EXISTS "is_listed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "spaces" ADD COLUMN IF NOT EXISTS "coworker_listing_id" TEXT;
ALTER TABLE "spaces" ADD COLUMN IF NOT EXISTS "liquidspace_listing_id" TEXT;
