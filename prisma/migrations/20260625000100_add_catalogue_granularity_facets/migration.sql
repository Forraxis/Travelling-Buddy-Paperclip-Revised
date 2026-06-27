-- Catalogue-granularity facets (CATALOGUE_GRANULARITY_PLAN.md §4, §8).
-- Adds structured config-facet columns so a variant pins a compliance-distinct
-- configuration instead of just model + year-range + free-text body label.
-- All columns nullable + additive → backward-compatible (the calculator keeps
-- reading the typed columns it already has; unfilled facets degrade to "not specified").

-- CreateEnum
CREATE TYPE "CabType" AS ENUM ('SINGLE_CAB', 'KING_CAB', 'DUAL_CAB', 'WAGON');

-- CreateEnum
-- DB labels keep the AU-ute convention (4x2/4x4); Prisma maps them to
-- TWO_WHEEL_DRIVE / FOUR_WHEEL_DRIVE / ALL_WHEEL_DRIVE.
CREATE TYPE "DriveType" AS ENUM ('4X2', '4X4', 'AWD');

-- AlterTable
ALTER TABLE "VehicleVariant"
    ADD COLUMN     "generation" TEXT,
    ADD COLUMN     "cabType" "CabType",
    ADD COLUMN     "driveType" "DriveType",
    ADD COLUMN     "badge" TEXT,
    ADD COLUMN     "engine" TEXT,
    ADD COLUMN     "transmission" TEXT;

-- AlterTable
ALTER TABLE "CaravanVariant"
    ADD COLUMN     "floorplan" TEXT,
    ADD COLUMN     "berths" INTEGER;
