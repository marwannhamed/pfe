-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "document_url" TEXT;

-- AlterTable
ALTER TABLE "lease_contracts" ADD COLUMN     "document_url" TEXT;

-- AlterTable
ALTER TABLE "spaces" ADD COLUMN     "photos" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "avatar_url" TEXT;
