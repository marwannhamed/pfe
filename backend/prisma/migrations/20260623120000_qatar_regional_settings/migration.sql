-- Qatar regional settings: default currency QAR, invoice tax_rate
ALTER TABLE "spaces" ALTER COLUMN "currency" SET DEFAULT 'QAR';
ALTER TABLE "invoices" ALTER COLUMN "currency" SET DEFAULT 'QAR';
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "tax_rate" DOUBLE PRECISION NOT NULL DEFAULT 0;
