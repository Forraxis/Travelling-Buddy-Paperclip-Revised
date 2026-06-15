-- CreateEnum
CREATE TYPE "PlacementScope" AS ENUM ('VEHICLE', 'CARAVAN', 'BOTH');

-- AlterTable
ALTER TABLE "Accessory" ADD COLUMN     "placementScope" "PlacementScope" NOT NULL DEFAULT 'BOTH';

-- AlterTable
ALTER TABLE "SetupCustomLoad" ADD COLUMN     "footprintLengthMm" INTEGER,
ADD COLUMN     "footprintWidthMm" INTEGER,
ADD COLUMN     "placementScope" "PlacementScope" NOT NULL DEFAULT 'BOTH',
ADD COLUMN     "side" "PlacementScope";

-- Backfill placementScope from existing fitments' mounting-location side.
-- An accessory whose fitments are all CARAVAN_* mounts is CARAVAN; all
-- vehicle mounts is VEHICLE; a mix (or used on both sides) is BOTH. Accessories
-- with no fitments keep the BOTH default.
UPDATE "Accessory" a SET "placementScope" = CASE
  WHEN NOT EXISTS (
    SELECT 1 FROM "AccessoryFitment" f
    WHERE f."accessoryId" = a.id AND f."mountingLocation"::text NOT LIKE 'CARAVAN_%'
  ) THEN 'CARAVAN'::"PlacementScope"
  WHEN NOT EXISTS (
    SELECT 1 FROM "AccessoryFitment" f
    WHERE f."accessoryId" = a.id AND f."mountingLocation"::text LIKE 'CARAVAN_%'
  ) THEN 'VEHICLE'::"PlacementScope"
  ELSE 'BOTH'::"PlacementScope"
END
WHERE EXISTS (SELECT 1 FROM "AccessoryFitment" f WHERE f."accessoryId" = a.id);
