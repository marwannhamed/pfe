-- AlterTable users: phone + receptionist manager link
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "phone_number" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "managed_by_id" TEXT;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_managed_by_id_fkey'
  ) THEN
    ALTER TABLE "users" ADD CONSTRAINT "users_managed_by_id_fkey"
      FOREIGN KEY ("managed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AlterTable bookings: receptionist assignment
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "receptionist_id" TEXT;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'bookings_receptionist_id_fkey'
  ) THEN
    ALTER TABLE "bookings" ADD CONSTRAINT "bookings_receptionist_id_fkey"
      FOREIGN KEY ("receptionist_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- CreateTable booking_documents
CREATE TABLE IF NOT EXISTS "booking_documents" (
    "id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "file_url" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "document_type" TEXT NOT NULL DEFAULT 'other',
    "uploaded_by" TEXT NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_documents_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'booking_documents_booking_id_fkey'
  ) THEN
    ALTER TABLE "booking_documents" ADD CONSTRAINT "booking_documents_booking_id_fkey"
      FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'booking_documents_uploaded_by_fkey'
  ) THEN
    ALTER TABLE "booking_documents" ADD CONSTRAINT "booking_documents_uploaded_by_fkey"
      FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
