-- CreateTable
CREATE TABLE "site_integrations" (
    "id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "config" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "site_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "site_integrations_site_id_provider_key" ON "site_integrations"("site_id", "provider");

-- AddForeignKey
ALTER TABLE "site_integrations" ADD CONSTRAINT "site_integrations_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
