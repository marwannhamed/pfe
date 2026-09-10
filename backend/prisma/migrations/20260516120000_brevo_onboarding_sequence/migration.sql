-- AlterTable
ALTER TABLE "tenants" ADD COLUMN "brevo_contact_id" TEXT;

-- CreateTable
CREATE TABLE "tenant_onboarding_sequences" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "baseline_at" TIMESTAMP(3) NOT NULL,
    "day0_sent_at" TIMESTAMP(3),
    "day1_sent_at" TIMESTAMP(3),
    "day3_sent_at" TIMESTAMP(3),
    "day7_sent_at" TIMESTAMP(3),
    "day30_sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_onboarding_sequences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenant_onboarding_sequences_tenant_id_key" ON "tenant_onboarding_sequences"("tenant_id");

-- AddForeignKey
ALTER TABLE "tenant_onboarding_sequences" ADD CONSTRAINT "tenant_onboarding_sequences_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN "overdue_reminder_max_day" INTEGER NOT NULL DEFAULT 0;
