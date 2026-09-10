-- Applicant type (individual vs company) on guest booking applications
ALTER TABLE "booking_applications" ADD COLUMN IF NOT EXISTS "applicant_type" TEXT NOT NULL DEFAULT 'INDIVIDUAL';
ALTER TABLE "booking_applications" ADD COLUMN IF NOT EXISTS "company_name" TEXT;
