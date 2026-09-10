-- AlterTable: public map location fields on spaces
ALTER TABLE "spaces" ADD COLUMN IF NOT EXISTS "is_published" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "spaces" ADD COLUMN IF NOT EXISTS "address" TEXT;
ALTER TABLE "spaces" ADD COLUMN IF NOT EXISTS "city" TEXT;
ALTER TABLE "spaces" ADD COLUMN IF NOT EXISTS "state" TEXT;
ALTER TABLE "spaces" ADD COLUMN IF NOT EXISTS "zip" TEXT;
ALTER TABLE "spaces" ADD COLUMN IF NOT EXISTS "country" TEXT;
ALTER TABLE "spaces" ADD COLUMN IF NOT EXISTS "map_lat" DOUBLE PRECISION;
ALTER TABLE "spaces" ADD COLUMN IF NOT EXISTS "map_lng" DOUBLE PRECISION;
ALTER TABLE "spaces" ADD COLUMN IF NOT EXISTS "transportation_notes" TEXT;

-- CreateTable: booking applications
CREATE TABLE IF NOT EXISTS "booking_applications" (
    "id" TEXT NOT NULL,
    "space_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "duration_months" INTEGER NOT NULL,
    "headcount" INTEGER NOT NULL,
    "intended_use" TEXT NOT NULL,
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewed_by_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "refusal_reason" TEXT,
    "booking_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "booking_applications_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "booking_applications_booking_id_key" ON "booking_applications"("booking_id");

ALTER TABLE "booking_applications" DROP CONSTRAINT IF EXISTS "booking_applications_space_id_fkey";
ALTER TABLE "booking_applications" ADD CONSTRAINT "booking_applications_space_id_fkey" FOREIGN KEY ("space_id") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "booking_applications" DROP CONSTRAINT IF EXISTS "booking_applications_user_id_fkey";
ALTER TABLE "booking_applications" ADD CONSTRAINT "booking_applications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "booking_applications" DROP CONSTRAINT IF EXISTS "booking_applications_reviewed_by_id_fkey";
ALTER TABLE "booking_applications" ADD CONSTRAINT "booking_applications_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "booking_applications" DROP CONSTRAINT IF EXISTS "booking_applications_booking_id_fkey";
ALTER TABLE "booking_applications" ADD CONSTRAINT "booking_applications_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
