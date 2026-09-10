-- Buildings belong to tenant directly (no sites)
ALTER TABLE "buildings" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;

UPDATE "buildings" b
SET "tenant_id" = s."tenant_id"
FROM "sites" s
WHERE b."site_id" = s."id" AND b."tenant_id" IS NULL;

UPDATE "buildings"
SET "tenant_id" = (SELECT "id" FROM "tenants" LIMIT 1)
WHERE "tenant_id" IS NULL;

ALTER TABLE "buildings" ALTER COLUMN "tenant_id" SET NOT NULL;

ALTER TABLE "buildings" DROP CONSTRAINT IF EXISTS "buildings_site_id_fkey";
ALTER TABLE "buildings" DROP COLUMN IF EXISTS "site_id";

ALTER TABLE "buildings" DROP CONSTRAINT IF EXISTS "buildings_tenant_id_fkey";
ALTER TABLE "buildings" ADD CONSTRAINT "buildings_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Bookings no longer reference sites
ALTER TABLE "bookings" DROP CONSTRAINT IF EXISTS "bookings_site_id_fkey";
ALTER TABLE "bookings" DROP COLUMN IF EXISTS "site_id";

-- Maintenance tickets
ALTER TABLE "maintenance_tickets" DROP CONSTRAINT IF EXISTS "maintenance_tickets_site_id_fkey";
ALTER TABLE "maintenance_tickets" DROP COLUMN IF EXISTS "site_id";

-- Tenant applications
ALTER TABLE "tenant_applications" DROP CONSTRAINT IF EXISTS "tenant_applications_site_id_fkey";
ALTER TABLE "tenant_applications" DROP COLUMN IF EXISTS "site_id";

-- Pricing, add-ons and promotion codes also referenced sites. Without these
-- the DROP below fails on a clean database with 2BP01 ("cannot drop table
-- sites because other objects depend on it"), which breaks replay of the
-- whole migration chain.
ALTER TABLE "price_plans" DROP CONSTRAINT IF EXISTS "price_plans_site_id_fkey";
ALTER TABLE "price_plans" DROP COLUMN IF EXISTS "site_id";

ALTER TABLE "addon_services" DROP CONSTRAINT IF EXISTS "addon_services_site_id_fkey";
ALTER TABLE "addon_services" DROP COLUMN IF EXISTS "site_id";

ALTER TABLE "promotion_codes" DROP CONSTRAINT IF EXISTS "promotion_codes_site_id_fkey";
ALTER TABLE "promotion_codes" DROP COLUMN IF EXISTS "site_id";

-- Drop sites table
DROP TABLE IF EXISTS "sites";
