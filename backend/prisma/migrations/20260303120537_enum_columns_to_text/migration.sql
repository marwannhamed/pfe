-- The initial schema typed 28 columns with PostgreSQL enum types. The Prisma
-- models now declare every one of them as String, but no migration ever
-- performed the conversion — development moved forward with `prisma db push`,
-- which reshapes the database without recording migrations.
--
-- Replaying the chain on a clean database therefore failed as soon as a later
-- migration wrote a value the old enum did not contain (22P02). This migration
-- closes that gap. Every statement is written to be a no-op on a database
-- where the column is already text.

ALTER TABLE IF EXISTS "tenants" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE IF EXISTS "tenants" ALTER COLUMN "status" TYPE TEXT USING "status"::TEXT;
ALTER TABLE IF EXISTS "tenants" ALTER COLUMN "status" SET DEFAULT 'TRIAL';
ALTER TABLE IF EXISTS "users" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE IF EXISTS "users" ALTER COLUMN "role" TYPE TEXT USING "role"::TEXT;
ALTER TABLE IF EXISTS "users" ALTER COLUMN "role" SET DEFAULT 'EMPLOYEE';
ALTER TABLE IF EXISTS "users" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE IF EXISTS "users" ALTER COLUMN "status" TYPE TEXT USING "status"::TEXT;
ALTER TABLE IF EXISTS "users" ALTER COLUMN "status" SET DEFAULT 'PENDING';
ALTER TABLE IF EXISTS "sites" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE IF EXISTS "sites" ALTER COLUMN "status" TYPE TEXT USING "status"::TEXT;
ALTER TABLE IF EXISTS "sites" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';
ALTER TABLE IF EXISTS "spaces" ALTER COLUMN "type" DROP DEFAULT;
ALTER TABLE IF EXISTS "spaces" ALTER COLUMN "type" TYPE TEXT USING "type"::TEXT;
ALTER TABLE IF EXISTS "spaces" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE IF EXISTS "spaces" ALTER COLUMN "status" TYPE TEXT USING "status"::TEXT;
ALTER TABLE IF EXISTS "spaces" ALTER COLUMN "status" SET DEFAULT 'AVAILABLE';
ALTER TABLE IF EXISTS "price_plans" ALTER COLUMN "space_type" DROP DEFAULT;
ALTER TABLE IF EXISTS "price_plans" ALTER COLUMN "space_type" TYPE TEXT USING "space_type"::TEXT;
ALTER TABLE IF EXISTS "price_plans" ALTER COLUMN "billing_cycle" DROP DEFAULT;
ALTER TABLE IF EXISTS "price_plans" ALTER COLUMN "billing_cycle" TYPE TEXT USING "billing_cycle"::TEXT;
ALTER TABLE IF EXISTS "addon_services" ALTER COLUMN "billing_cycle" DROP DEFAULT;
ALTER TABLE IF EXISTS "addon_services" ALTER COLUMN "billing_cycle" TYPE TEXT USING "billing_cycle"::TEXT;
ALTER TABLE IF EXISTS "promotion_codes" ALTER COLUMN "discount_type" DROP DEFAULT;
ALTER TABLE IF EXISTS "promotion_codes" ALTER COLUMN "discount_type" TYPE TEXT USING "discount_type"::TEXT;
ALTER TABLE IF EXISTS "bookings" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE IF EXISTS "bookings" ALTER COLUMN "status" TYPE TEXT USING "status"::TEXT;
ALTER TABLE IF EXISTS "bookings" ALTER COLUMN "status" SET DEFAULT 'DRAFT';
ALTER TABLE IF EXISTS "lease_contracts" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE IF EXISTS "lease_contracts" ALTER COLUMN "status" TYPE TEXT USING "status"::TEXT;
ALTER TABLE IF EXISTS "lease_contracts" ALTER COLUMN "status" SET DEFAULT 'DRAFT';
ALTER TABLE IF EXISTS "contract_items" ALTER COLUMN "item_type" DROP DEFAULT;
ALTER TABLE IF EXISTS "contract_items" ALTER COLUMN "item_type" TYPE TEXT USING "item_type"::TEXT;
ALTER TABLE IF EXISTS "deposits" ALTER COLUMN "refund_status" DROP DEFAULT;
ALTER TABLE IF EXISTS "deposits" ALTER COLUMN "refund_status" TYPE TEXT USING "refund_status"::TEXT;
ALTER TABLE IF EXISTS "deposits" ALTER COLUMN "refund_status" SET DEFAULT 'PENDING';
ALTER TABLE IF EXISTS "invoices" ALTER COLUMN "type" DROP DEFAULT;
ALTER TABLE IF EXISTS "invoices" ALTER COLUMN "type" TYPE TEXT USING "type"::TEXT;
ALTER TABLE IF EXISTS "invoices" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE IF EXISTS "invoices" ALTER COLUMN "status" TYPE TEXT USING "status"::TEXT;
ALTER TABLE IF EXISTS "invoices" ALTER COLUMN "status" SET DEFAULT 'DRAFT';
ALTER TABLE IF EXISTS "payments" ALTER COLUMN "payment_method" DROP DEFAULT;
ALTER TABLE IF EXISTS "payments" ALTER COLUMN "payment_method" TYPE TEXT USING "payment_method"::TEXT;
ALTER TABLE IF EXISTS "payments" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE IF EXISTS "payments" ALTER COLUMN "status" TYPE TEXT USING "status"::TEXT;
ALTER TABLE IF EXISTS "payments" ALTER COLUMN "status" SET DEFAULT 'PENDING';
ALTER TABLE IF EXISTS "maintenance_tickets" ALTER COLUMN "category" DROP DEFAULT;
ALTER TABLE IF EXISTS "maintenance_tickets" ALTER COLUMN "category" TYPE TEXT USING "category"::TEXT;
ALTER TABLE IF EXISTS "maintenance_tickets" ALTER COLUMN "priority" DROP DEFAULT;
ALTER TABLE IF EXISTS "maintenance_tickets" ALTER COLUMN "priority" TYPE TEXT USING "priority"::TEXT;
ALTER TABLE IF EXISTS "maintenance_tickets" ALTER COLUMN "priority" SET DEFAULT 'NORMAL';
ALTER TABLE IF EXISTS "maintenance_tickets" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE IF EXISTS "maintenance_tickets" ALTER COLUMN "status" TYPE TEXT USING "status"::TEXT;
ALTER TABLE IF EXISTS "maintenance_tickets" ALTER COLUMN "status" SET DEFAULT 'OPEN';
ALTER TABLE IF EXISTS "notifications" ALTER COLUMN "type" DROP DEFAULT;
ALTER TABLE IF EXISTS "notifications" ALTER COLUMN "type" TYPE TEXT USING "type"::TEXT;
ALTER TABLE IF EXISTS "notifications" ALTER COLUMN "channel" DROP DEFAULT;
ALTER TABLE IF EXISTS "notifications" ALTER COLUMN "channel" TYPE TEXT USING "channel"::TEXT;
ALTER TABLE IF EXISTS "notifications" ALTER COLUMN "priority" DROP DEFAULT;
ALTER TABLE IF EXISTS "notifications" ALTER COLUMN "priority" TYPE TEXT USING "priority"::TEXT;
ALTER TABLE IF EXISTS "notifications" ALTER COLUMN "priority" SET DEFAULT 'NORMAL';
ALTER TABLE IF EXISTS "reports" ALTER COLUMN "report_type" DROP DEFAULT;
ALTER TABLE IF EXISTS "reports" ALTER COLUMN "report_type" TYPE TEXT USING "report_type"::TEXT;
ALTER TABLE IF EXISTS "reports" ALTER COLUMN "format" DROP DEFAULT;
ALTER TABLE IF EXISTS "reports" ALTER COLUMN "format" TYPE TEXT USING "format"::TEXT;
ALTER TABLE IF EXISTS "audit_logs" ALTER COLUMN "action" DROP DEFAULT;
ALTER TABLE IF EXISTS "audit_logs" ALTER COLUMN "action" TYPE TEXT USING "action"::TEXT;
ALTER TABLE IF EXISTS "audit_logs" ALTER COLUMN "severity" DROP DEFAULT;
ALTER TABLE IF EXISTS "audit_logs" ALTER COLUMN "severity" TYPE TEXT USING "severity"::TEXT;
ALTER TABLE IF EXISTS "audit_logs" ALTER COLUMN "severity" SET DEFAULT 'INFO';

-- With no column referencing them, the enum types can go.
DROP TYPE IF EXISTS "TenantStatus";
DROP TYPE IF EXISTS "UserStatus";
DROP TYPE IF EXISTS "UserRole";
DROP TYPE IF EXISTS "SpaceType";
DROP TYPE IF EXISTS "SpaceStatus";
DROP TYPE IF EXISTS "SiteStatus";
DROP TYPE IF EXISTS "BillingCycle";
DROP TYPE IF EXISTS "DiscountType";
DROP TYPE IF EXISTS "BookingStatus";
DROP TYPE IF EXISTS "ContractStatus";
DROP TYPE IF EXISTS "ContractItemType";
DROP TYPE IF EXISTS "DepositRefundStatus";
DROP TYPE IF EXISTS "InvoiceType";
DROP TYPE IF EXISTS "InvoiceStatus";
DROP TYPE IF EXISTS "PaymentMethod";
DROP TYPE IF EXISTS "PaymentStatus";
DROP TYPE IF EXISTS "TicketPriority";
DROP TYPE IF EXISTS "TicketCategory";
DROP TYPE IF EXISTS "TicketStatus";
DROP TYPE IF EXISTS "NotificationType";
DROP TYPE IF EXISTS "NotificationChannel";
DROP TYPE IF EXISTS "NotificationPriority";
DROP TYPE IF EXISTS "ReportType";
DROP TYPE IF EXISTS "ReportFormat";
DROP TYPE IF EXISTS "AuditAction";
DROP TYPE IF EXISTS "AuditSeverity";
