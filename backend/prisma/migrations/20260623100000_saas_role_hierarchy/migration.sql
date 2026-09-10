-- SaaS role hierarchy: client workspace roles + renter portal roles
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "organization_type" TEXT NOT NULL DEFAULT 'CLIENT';

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "must_change_password" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "tenant_company_id" TEXT;

-- Rename legacy roles
UPDATE "users" SET "role" = 'MANAGER' WHERE "role" = 'SITE_MANAGER';
UPDATE "users" SET "role" = 'TENANT_EMPLOYEE' WHERE "role" = 'EMPLOYEE';

-- Renter portal users: scope to their company record
UPDATE "users"
SET "tenant_company_id" = "tenant_id"
WHERE "role" IN ('TENANT_ADMIN', 'TENANT_EMPLOYEE') AND "tenant_company_id" IS NULL;

-- Demo renter org
UPDATE "tenants" SET "organization_type" = 'RENTER' WHERE "slug" = 'acme-corp';

-- FK for tenant_company_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_tenant_company_id_fkey'
  ) THEN
    ALTER TABLE "users"
      ADD CONSTRAINT "users_tenant_company_id_fkey"
      FOREIGN KEY ("tenant_company_id") REFERENCES "tenants"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
