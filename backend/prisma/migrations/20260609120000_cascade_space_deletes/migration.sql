-- Align DB with schema: deleting a space cascades to its bookings
ALTER TABLE "bookings" DROP CONSTRAINT IF EXISTS "bookings_space_id_fkey";
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_space_id_fkey"
  FOREIGN KEY ("space_id") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Remove orphaned spaces (floor was deleted but space row remained)
DELETE FROM "spaces" s
WHERE NOT EXISTS (SELECT 1 FROM "floors" f WHERE f.id = s.floor_id);
