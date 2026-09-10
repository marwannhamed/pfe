-- AlterTable
ALTER TABLE "buildings" ADD COLUMN IF NOT EXISTS "total_floors_in_building" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "floors_building_id_floor_number_key" ON "floors"("building_id", "floor_number");
