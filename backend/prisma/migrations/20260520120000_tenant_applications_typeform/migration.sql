-- AlterTable
ALTER TABLE "tenants" ADD COLUMN "application_profile" JSONB;
ALTER TABLE "tenants" ADD COLUMN "application_documents" JSONB;

-- CreateTable
CREATE TABLE "tenant_applications" (
    "id" TEXT NOT NULL,
    "landlord_tenant_id" TEXT NOT NULL,
    "site_id" TEXT,
    "space_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'AWAITING_SUBMISSION',
    "typeform_response_id" TEXT,
    "applicant_tenant_id" TEXT,
    "contact_email" TEXT,
    "company_name" TEXT,
    "raw_payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_applications_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tenant_applications_typeform_response_id_key" ON "tenant_applications"("typeform_response_id");
CREATE UNIQUE INDEX "tenant_applications_applicant_tenant_id_key" ON "tenant_applications"("applicant_tenant_id");

ALTER TABLE "tenant_applications" ADD CONSTRAINT "tenant_applications_landlord_tenant_id_fkey" FOREIGN KEY ("landlord_tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tenant_applications" ADD CONSTRAINT "tenant_applications_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tenant_applications" ADD CONSTRAINT "tenant_applications_space_id_fkey" FOREIGN KEY ("space_id") REFERENCES "spaces"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tenant_applications" ADD CONSTRAINT "tenant_applications_applicant_tenant_id_fkey" FOREIGN KEY ("applicant_tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
