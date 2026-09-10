-- opening_hours already exists on sites from 20260303120536_init_full_schema
ALTER TABLE "sites" ADD COLUMN IF NOT EXISTS "gmb_location_id" TEXT;
ALTER TABLE "sites" ADD COLUMN IF NOT EXISTS "gmb_account_id" TEXT;
ALTER TABLE "sites" ADD COLUMN IF NOT EXISTS "gmb_refresh_token" TEXT;
