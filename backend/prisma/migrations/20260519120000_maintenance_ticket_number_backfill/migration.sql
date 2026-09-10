-- Backfill ticket_number for existing maintenance tickets
ALTER TABLE "maintenance_tickets" ADD COLUMN IF NOT EXISTS "ticket_number" TEXT;

UPDATE "maintenance_tickets"
SET "ticket_number" = 'MT-' || UPPER(SUBSTRING(REPLACE("id"::text, '-', ''), 1, 8))
WHERE "ticket_number" IS NULL;

ALTER TABLE "maintenance_tickets" ALTER COLUMN "ticket_number" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "maintenance_tickets_ticket_number_key"
  ON "maintenance_tickets"("ticket_number");
