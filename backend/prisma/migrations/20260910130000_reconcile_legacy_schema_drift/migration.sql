-- Reconcile the migration chain with schema.prisma.
--
-- Development moved forward with `prisma db push`, which reshapes the database
-- directly without recording migrations. The models therefore drifted far from
-- what the migration chain produces: replaying every migration on a clean
-- database left 382 lines of difference from schema.prisma — renamed tables,
-- columns that were added or dropped only via push, and four tables whose
-- models no longer exist (price_plans, contract_items, deposits, booking_addons).
--
-- This migration applies that difference, so a clean `prisma migrate deploy`
-- now yields exactly the schema the application expects.
--
-- The dropped tables carry no code: nothing references prisma.contractItem,
-- prisma.deposit or prisma.bookingAddon, and PricePlanService already treats a
-- missing pricePlan model as unavailable and throws NotImplementedException.
--
-- NOTE: this is written for a clean replay. Several columns are added as NOT
-- NULL without a default, which PostgreSQL rejects on a table that already has
-- rows. An existing database that was built with `db push` is already in the
-- target shape, so baseline it instead of migrating it:
--   prisma migrate resolve --applied <each migration name>

-- DropForeignKey
ALTER TABLE "audit_logs" DROP CONSTRAINT "audit_logs_tenant_id_fkey";

-- DropForeignKey
ALTER TABLE "booking_addons" DROP CONSTRAINT "booking_addons_addon_service_id_fkey";

-- DropForeignKey
ALTER TABLE "booking_addons" DROP CONSTRAINT "booking_addons_booking_id_fkey";

-- DropForeignKey
ALTER TABLE "bookings" DROP CONSTRAINT "bookings_approved_by_user_id_fkey";

-- DropForeignKey
ALTER TABLE "bookings" DROP CONSTRAINT "bookings_created_by_user_id_fkey";

-- DropForeignKey
ALTER TABLE "bookings" DROP CONSTRAINT "bookings_parent_booking_id_fkey";

-- DropForeignKey
ALTER TABLE "bookings" DROP CONSTRAINT "bookings_price_plan_id_fkey";

-- DropForeignKey
ALTER TABLE "bookings" DROP CONSTRAINT "bookings_promotion_code_id_fkey";

-- DropForeignKey
ALTER TABLE "bookings" DROP CONSTRAINT "bookings_tenant_id_fkey";

-- DropForeignKey
ALTER TABLE "contract_items" DROP CONSTRAINT "contract_items_addon_service_id_fkey";

-- DropForeignKey
ALTER TABLE "contract_items" DROP CONSTRAINT "contract_items_contract_id_fkey";

-- DropForeignKey
ALTER TABLE "contract_items" DROP CONSTRAINT "contract_items_space_id_fkey";

-- DropForeignKey
ALTER TABLE "deposits" DROP CONSTRAINT "deposits_contract_id_fkey";

-- DropForeignKey
ALTER TABLE "invoices" DROP CONSTRAINT "invoices_tenant_id_fkey";

-- DropForeignKey
ALTER TABLE "lease_contracts" DROP CONSTRAINT "lease_contracts_created_by_user_id_fkey";

-- DropForeignKey
ALTER TABLE "lease_contracts" DROP CONSTRAINT "lease_contracts_tenant_id_fkey";

-- DropForeignKey
ALTER TABLE "maintenance_tickets" DROP CONSTRAINT "maintenance_tickets_assigned_to_user_id_fkey";

-- DropForeignKey
ALTER TABLE "maintenance_tickets" DROP CONSTRAINT "maintenance_tickets_created_by_user_id_fkey";

-- DropForeignKey
ALTER TABLE "maintenance_tickets" DROP CONSTRAINT "maintenance_tickets_space_id_fkey";

-- DropForeignKey
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_user_id_fkey";

-- DropForeignKey
ALTER TABLE "payments" DROP CONSTRAINT "payments_invoice_id_fkey";

-- DropForeignKey
ALTER TABLE "payments" DROP CONSTRAINT "payments_recorded_by_user_id_fkey";

-- DropForeignKey
ALTER TABLE "payments" DROP CONSTRAINT "payments_tenant_id_fkey";

-- DropIndex
DROP INDEX "payments_payment_number_key";

-- DropIndex
DROP INDEX "spaces_code_key";

-- AlterTable
-- PostgreSQL does not accept RENAME CONSTRAINT alongside other actions in one
-- ALTER TABLE, so it is split out from the block `migrate diff` generated.
ALTER TABLE "add_on_services" RENAME CONSTRAINT "addon_services_pkey" TO "add_on_services_pkey";

ALTER TABLE "add_on_services" DROP COLUMN "currency",
DROP COLUMN "is_recurring",
ADD COLUMN     "description" TEXT,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "tenant_id" TEXT NOT NULL,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "category" DROP NOT NULL,
ALTER COLUMN "price" SET DEFAULT 0,
ALTER COLUMN "price" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "billing_cycle" SET DEFAULT 'HOURLY';

-- AlterTable
ALTER TABLE "audit_logs" ADD COLUMN     "entity_id" TEXT,
ADD COLUMN     "entity_type" TEXT,
ADD COLUMN     "user_agent" TEXT,
ALTER COLUMN "resource_type" DROP NOT NULL,
ALTER COLUMN "resource_id" DROP NOT NULL,
ALTER COLUMN "old_values" SET DATA TYPE TEXT,
ALTER COLUMN "new_values" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "bookings" DROP COLUMN "approved_by_user_id",
DROP COLUMN "attendee_count",
DROP COLUMN "checked_in_at",
DROP COLUMN "checked_out_at",
DROP COLUMN "created_by_user_id",
DROP COLUMN "currency",
DROP COLUMN "end_datetime",
DROP COLUMN "parent_booking_id",
DROP COLUMN "price_plan_id",
DROP COLUMN "promotion_code_id",
DROP COLUMN "start_datetime",
ADD COLUMN     "end_time" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "invoice_id" TEXT,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "start_time" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "total_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "user_id" TEXT NOT NULL,
ALTER COLUMN "total_price" DROP NOT NULL,
ALTER COLUMN "total_price" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "buildings" DROP COLUMN "code",
DROP COLUMN "floors_count",
ADD COLUMN     "address" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "slug" TEXT NOT NULL,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "total_area_sqm" SET DEFAULT 0,
ALTER COLUMN "total_area_sqm" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "floors" ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "area_sqm" DROP NOT NULL,
ALTER COLUMN "area_sqm" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "invoice_lines" ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "quantity" SET DEFAULT 1,
ALTER COLUMN "quantity" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "unit_price" SET DEFAULT 0,
ALTER COLUMN "unit_price" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "tax_rate" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "line_total" SET DEFAULT 0,
ALTER COLUMN "line_total" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "invoices" DROP COLUMN "document_url",
DROP COLUMN "notes",
ADD COLUMN     "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "paid_at" TIMESTAMP(3),
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "user_id" TEXT,
ALTER COLUMN "issue_date" SET DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "due_date" DROP NOT NULL,
ALTER COLUMN "subtotal" SET DEFAULT 0,
ALTER COLUMN "subtotal" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "tax_amount" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "total_amount" SET DEFAULT 0,
ALTER COLUMN "total_amount" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "lease_contracts" DROP COLUMN "auto_renew",
DROP COLUMN "created_by_user_id",
DROP COLUMN "currency",
DROP COLUMN "deposit_amount",
DROP COLUMN "document_url",
DROP COLUMN "payment_due_day",
DROP COLUMN "signed_at",
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "user_id" TEXT,
ALTER COLUMN "monthly_rent" DROP NOT NULL,
ALTER COLUMN "monthly_rent" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "maintenance_tickets" DROP COLUMN "assigned_to_user_id",
DROP COLUMN "estimated_hours",
ADD COLUMN     "assigned_to" TEXT,
ADD COLUMN     "booking_id" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "tenant_id" TEXT NOT NULL,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "user_id" TEXT,
ALTER COLUMN "space_id" DROP NOT NULL,
ALTER COLUMN "created_by_user_id" DROP NOT NULL,
ALTER COLUMN "cost" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "data" TEXT,
ADD COLUMN     "tenant_id" TEXT NOT NULL,
ALTER COLUMN "user_id" DROP NOT NULL,
ALTER COLUMN "channel" SET DEFAULT 'IN_APP';

-- AlterTable
ALTER TABLE "payments" DROP COLUMN "currency",
DROP COLUMN "payment_method",
DROP COLUMN "recorded_by_user_id",
DROP COLUMN "reference_number",
ADD COLUMN     "method" TEXT NOT NULL,
ADD COLUMN     "paid_at" TIMESTAMP(3),
ADD COLUMN     "recorded_by_id" TEXT,
ADD COLUMN     "transaction_id" TEXT,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "user_id" TEXT,
ALTER COLUMN "invoice_id" DROP NOT NULL,
ALTER COLUMN "payment_number" DROP NOT NULL,
ALTER COLUMN "amount" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "payment_date" DROP NOT NULL;

-- AlterTable
ALTER TABLE "promotion_codes" DROP COLUMN "discount_type",
DROP COLUMN "discount_value",
DROP COLUMN "uses_count",
DROP COLUMN "valid_to",
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "discount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'PERCENTAGE',
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "used_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "valid_until" TIMESTAMP(3),
ALTER COLUMN "valid_from" DROP NOT NULL;

-- AlterTable
ALTER TABLE "space_features" DROP COLUMN "feature_name",
DROP COLUMN "feature_type",
DROP COLUMN "is_available",
DROP COLUMN "quantity",
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "name" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "spaces" DROP COLUMN "code",
DROP COLUMN "price_per_day",
DROP COLUMN "price_per_hour",
DROP COLUMN "price_per_month",
ADD COLUMN     "daily_rate" DOUBLE PRECISION,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "hourly_rate" DOUBLE PRECISION,
ADD COLUMN     "monthly_rate" DOUBLE PRECISION,
ADD COLUMN     "slug" TEXT NOT NULL,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "capacity" DROP NOT NULL,
ALTER COLUMN "area_sqm" DROP NOT NULL,
ALTER COLUMN "area_sqm" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "map_h" DROP DEFAULT,
ALTER COLUMN "map_w" DROP DEFAULT;

-- AlterTable
ALTER TABLE "tenants" DROP COLUMN "settings";

-- AlterTable
ALTER TABLE "users" DROP COLUMN "preferences",
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "role" SET DEFAULT 'TENANT_EMPLOYEE',
ALTER COLUMN "refreshToken" SET DATA TYPE TEXT,
ALTER COLUMN "first_name" DROP NOT NULL,
ALTER COLUMN "last_name" DROP NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'ACTIVE';

-- DropTable
DROP TABLE "booking_addons";

-- DropTable
DROP TABLE "contract_items";

-- DropTable
DROP TABLE "deposits";

-- DropTable
DROP TABLE "price_plans";

-- CreateTable
CREATE TABLE "booking_add_ons" (
    "id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "addon_service_id" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "unit_price" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "booking_add_ons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_BookingToPayment" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_BookingToPayment_AB_unique" ON "_BookingToPayment"("A", "B");

-- CreateIndex
CREATE INDEX "_BookingToPayment_B_index" ON "_BookingToPayment"("B");

-- CreateIndex
CREATE UNIQUE INDEX "buildings_slug_key" ON "buildings"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "payments_transaction_id_key" ON "payments"("transaction_id");

-- CreateIndex
CREATE UNIQUE INDEX "spaces_slug_key" ON "spaces"("slug");

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lease_contracts" ADD CONSTRAINT "lease_contracts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lease_contracts" ADD CONSTRAINT "lease_contracts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_recorded_by_id_fkey" FOREIGN KEY ("recorded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "add_on_services" ADD CONSTRAINT "add_on_services_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_add_ons" ADD CONSTRAINT "booking_add_ons_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_add_ons" ADD CONSTRAINT "booking_add_ons_addon_service_id_fkey" FOREIGN KEY ("addon_service_id") REFERENCES "add_on_services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_tickets" ADD CONSTRAINT "maintenance_tickets_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_tickets" ADD CONSTRAINT "maintenance_tickets_space_id_fkey" FOREIGN KEY ("space_id") REFERENCES "spaces"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_tickets" ADD CONSTRAINT "maintenance_tickets_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_tickets" ADD CONSTRAINT "maintenance_tickets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_tickets" ADD CONSTRAINT "maintenance_tickets_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_tickets" ADD CONSTRAINT "maintenance_tickets_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_BookingToPayment" ADD CONSTRAINT "_BookingToPayment_A_fkey" FOREIGN KEY ("A") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_BookingToPayment" ADD CONSTRAINT "_BookingToPayment_B_fkey" FOREIGN KEY ("B") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

