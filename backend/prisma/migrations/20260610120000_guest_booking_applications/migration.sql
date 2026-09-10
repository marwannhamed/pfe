ALTER TABLE "booking_applications" ALTER COLUMN "user_id" DROP NOT NULL;

ALTER TABLE "booking_applications" DROP CONSTRAINT IF EXISTS "booking_applications_user_id_fkey";
ALTER TABLE "booking_applications" ADD CONSTRAINT "booking_applications_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "booking_applications" ADD COLUMN IF NOT EXISTS "guest_name" TEXT;
ALTER TABLE "booking_applications" ADD COLUMN IF NOT EXISTS "guest_email" TEXT;
ALTER TABLE "booking_applications" ADD COLUMN IF NOT EXISTS "guest_phone" TEXT;
