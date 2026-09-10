CREATE TABLE IF NOT EXISTS "space_addon_services" (
  "id" TEXT NOT NULL,
  "space_id" TEXT NOT NULL,
  "addon_service_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "space_addon_services_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "space_addon_services_space_id_addon_service_id_key"
  ON "space_addon_services"("space_id", "addon_service_id");

ALTER TABLE "space_addon_services"
  ADD CONSTRAINT "space_addon_services_space_id_fkey"
  FOREIGN KEY ("space_id") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "space_addon_services"
  ADD CONSTRAINT "space_addon_services_addon_service_id_fkey"
  FOREIGN KEY ("addon_service_id") REFERENCES "add_on_services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "booking_application_add_ons" (
  "id" TEXT NOT NULL,
  "application_id" TEXT NOT NULL,
  "addon_service_id" TEXT NOT NULL,
  "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
  "unit_price" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "booking_application_add_ons_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "booking_application_add_ons"
  ADD CONSTRAINT "booking_application_add_ons_application_id_fkey"
  FOREIGN KEY ("application_id") REFERENCES "booking_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "booking_application_add_ons"
  ADD CONSTRAINT "booking_application_add_ons_addon_service_id_fkey"
  FOREIGN KEY ("addon_service_id") REFERENCES "add_on_services"("id") ON DELETE CASCADE ON UPDATE CASCADE;
