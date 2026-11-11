-- Every booking form asks how many people are coming and the API accepted
-- attendee_count, but the column was dropped in
-- 20260910130000_reconcile_legacy_schema_drift, so the number was discarded
-- and every booking read "1 person". Existing rows keep that default.
ALTER TABLE "bookings" ADD COLUMN "attendee_count" INTEGER NOT NULL DEFAULT 1;
