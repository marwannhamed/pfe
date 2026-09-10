-- AlterTable
ALTER TABLE "users" ADD COLUMN "crisp_session_id" TEXT;

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN "crisp_session_id" TEXT;

-- AlterTable
ALTER TABLE "maintenance_tickets" ADD COLUMN "crisp_session_id" TEXT;
