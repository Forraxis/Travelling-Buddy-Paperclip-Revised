-- CreateEnum
CREATE TYPE "MountingLocation" AS ENUM ('CHASSIS_FRONT', 'CHASSIS_MID', 'CHASSIS_REAR', 'BULL_BAR', 'ROOF_RACK', 'ROOF_RAILS', 'TRAY_FLOOR', 'TRAY_SIDE_LEFT', 'TRAY_SIDE_RIGHT', 'TRAY_HEADBOARD', 'TRAY_TAILGATE', 'CANOPY_EXTERIOR', 'CANOPY_INTERIOR', 'CANOPY_ROOF', 'TUB_INTERIOR', 'TUB_EXTERIOR', 'BONNET', 'REAR_BAR', 'TOW_HITCH', 'WHEEL_ARCH_LEFT', 'WHEEL_ARCH_RIGHT', 'UNDERBODY_FRONT', 'UNDERBODY_MID', 'UNDERBODY_REAR', 'A_PILLAR_LEFT', 'A_PILLAR_RIGHT', 'WINDSCREEN', 'CABIN_INTERIOR', 'CABIN_ROOF', 'CABIN_DASH', 'DOOR_LEFT', 'DOOR_RIGHT', 'SNORKEL', 'FENDER_LEFT', 'FENDER_RIGHT', 'CARAVAN_DRAWBAR', 'CARAVAN_A_FRAME', 'CARAVAN_CHASSIS_FRONT', 'CARAVAN_CHASSIS_MID', 'CARAVAN_CHASSIS_REAR', 'CARAVAN_UNDERBODY', 'CARAVAN_ROOF', 'CARAVAN_WALL_LEFT', 'CARAVAN_WALL_RIGHT', 'CARAVAN_WALL_FRONT', 'CARAVAN_WALL_REAR', 'CARAVAN_BUMPER_BAR', 'CARAVAN_BOOT', 'CARAVAN_TUNNEL_BOOT', 'CARAVAN_TOOLBAR_EXTERNAL', 'CARAVAN_TOOLBAR_INTERNAL');

-- CreateEnum
CREATE TYPE "PositionType" AS ENUM ('FIXED', 'ADJUSTABLE', 'MODULAR', 'SLIDING');

-- CreateEnum
CREATE TYPE "FitmentConfidence" AS ENUM ('VERIFIED', 'MANUFACTURER_SPEC', 'COMMUNITY', 'ESTIMATED');

-- CreateEnum
CREATE TYPE "FitmentSource" AS ENUM ('OEM', 'AFTERMARKET_VERIFIED', 'USER_SUBMITTED', 'CALCULATED');

-- CreateTable
CREATE TABLE "AccessoryFitment" (
    "id" TEXT NOT NULL,
    "accessoryId" TEXT NOT NULL,
    "vehicleVariantId" TEXT,
    "caravanVariantId" TEXT,
    "installedWeightKg" DECIMAL(8,2) NOT NULL,
    "positionType" "PositionType" NOT NULL,
    "cogXMm" INTEGER,
    "cogYMm" INTEGER,
    "startXMm" INTEGER,
    "endXMm" INTEGER,
    "mountingLocation" "MountingLocation" NOT NULL,
    "providesMountingLocations" "MountingLocation"[],
    "mountOffsetXMm" INTEGER,
    "mountOffsetYMm" INTEGER,
    "mountOffsetZMm" INTEGER,
    "tankCapacityL" DECIMAL(8,2),
    "tankContentsKgPerL" DECIMAL(6,3),
    "confidence" "FitmentConfidence" NOT NULL DEFAULT 'ESTIMATED',
    "source" "FitmentSource" NOT NULL DEFAULT 'USER_SUBMITTED',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccessoryFitment_pkey" PRIMARY KEY ("id")
);

-- ExactlyOneVariant constraint
ALTER TABLE "AccessoryFitment" ADD CONSTRAINT "chk_exactly_one_variant"
    CHECK (
        ("vehicleVariantId" IS NOT NULL AND "caravanVariantId" IS NULL)
        OR ("vehicleVariantId" IS NULL AND "caravanVariantId" IS NOT NULL)
    );

-- CreateIndex
CREATE INDEX "AccessoryFitment_vehicleVariantId_mountingLocation_idx" ON "AccessoryFitment"("vehicleVariantId", "mountingLocation");

-- CreateIndex
CREATE INDEX "AccessoryFitment_caravanVariantId_mountingLocation_idx" ON "AccessoryFitment"("caravanVariantId", "mountingLocation");

-- CreateIndex
CREATE INDEX "AccessoryFitment_accessoryId_idx" ON "AccessoryFitment"("accessoryId");

-- AddForeignKey
ALTER TABLE "AccessoryFitment" ADD CONSTRAINT "AccessoryFitment_accessoryId_fkey" FOREIGN KEY ("accessoryId") REFERENCES "Accessory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessoryFitment" ADD CONSTRAINT "AccessoryFitment_vehicleVariantId_fkey" FOREIGN KEY ("vehicleVariantId") REFERENCES "VehicleVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessoryFitment" ADD CONSTRAINT "AccessoryFitment_caravanVariantId_fkey" FOREIGN KEY ("caravanVariantId") REFERENCES "CaravanVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
