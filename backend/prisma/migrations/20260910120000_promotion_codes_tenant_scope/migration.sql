-- Promotion codes were global: a code created by one client organisation
-- could be validated and applied against any other client's invoices.
-- Give every code an owning tenant and scope uniqueness to that tenant.

-- 1. Add the column nullable so existing rows can be backfilled.
ALTER TABLE "promotion_codes" ADD COLUMN "tenant_id" TEXT;

-- 2. Backfill to the oldest CLIENT organisation. Invoices keep pointing at
--    their code either way (invoices.promotion_code_id is ON DELETE SET NULL),
--    so no invoice history is lost.
UPDATE "promotion_codes"
SET "tenant_id" = (
  SELECT "id" FROM "tenants"
  WHERE "organization_type" = 'CLIENT'
  ORDER BY "created_at" ASC
  LIMIT 1
)
WHERE "tenant_id" IS NULL;

-- 3. A row still unassigned means the database has no CLIENT organisation at
--    all, so the code cannot belong to anyone. Drop it rather than invent an
--    owner.
DELETE FROM "promotion_codes" WHERE "tenant_id" IS NULL;

-- 4. Ownership is now mandatory.
ALTER TABLE "promotion_codes" ALTER COLUMN "tenant_id" SET NOT NULL;

-- 5. Codes are unique per tenant rather than globally, so two clients can each
--    run a campaign called "SUMMER2026".
DROP INDEX IF EXISTS "promotion_codes_code_key";
CREATE UNIQUE INDEX "promotion_codes_tenant_id_code_key" ON "promotion_codes"("tenant_id", "code");
CREATE INDEX "promotion_codes_tenant_id_idx" ON "promotion_codes"("tenant_id");

-- 6. Deleting a tenant removes its codes.
ALTER TABLE "promotion_codes"
  ADD CONSTRAINT "promotion_codes_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
