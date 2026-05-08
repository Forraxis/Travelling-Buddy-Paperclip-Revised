-- Enable btree_gist extension (required for exclusion constraint on year ranges)
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- CreateEnum
CREATE TYPE "VehicleBodyType" AS ENUM ('DUAL_CAB_UTE', 'SINGLE_CAB_UTE', 'EXTRA_CAB_UTE', 'WAGON', 'SUV', 'VAN', 'TROOPCARRIER', 'OTHER');

-- CreateEnum
CREATE TYPE "FuelType" AS ENUM ('DIESEL', 'PETROL', 'HYBRID', 'ELECTRIC');

-- CreateEnum
CREATE TYPE "Market" AS ENUM ('AU', 'NZ', 'US', 'EU', 'GB');

-- CreateTable
CREATE TABLE "VehicleMake" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logoUrl" TEXT,
    "countryOfOrigin" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VehicleMake_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleModel" (
    "id" TEXT NOT NULL,
    "makeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "bodyType" "VehicleBodyType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VehicleModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleVariant" (
    "id" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "yearFrom" INTEGER NOT NULL,
    "yearTo" INTEGER NOT NULL,
    "isCurrentProduction" BOOLEAN NOT NULL DEFAULT false,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "gvmKg" INTEGER NOT NULL,
    "gcmKg" INTEGER NOT NULL,
    "kerbWeightKg" INTEGER NOT NULL,
    "maxTowingCapacityKg" INTEGER NOT NULL,
    "frontAxleLimitKg" INTEGER NOT NULL,
    "rearAxleLimitKg" INTEGER NOT NULL,
    "wheelbaseMm" INTEGER NOT NULL,
    "frontOverhangMm" INTEGER,
    "rearOverhangMm" INTEGER,
    "totalLengthMm" INTEGER,
    "maxTowBallDownloadKg" INTEGER NOT NULL,
    "fuelTankCapacityL" INTEGER NOT NULL,
    "fuelType" "FuelType" NOT NULL,
    "market" "Market" NOT NULL DEFAULT 'AU',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VehicleVariant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VehicleMake_name_key" ON "VehicleMake"("name");

-- CreateIndex
CREATE UNIQUE INDEX "VehicleMake_slug_key" ON "VehicleMake"("slug");

-- CreateIndex
CREATE INDEX "VehicleMake_slug_idx" ON "VehicleMake"("slug");

-- CreateIndex
CREATE INDEX "VehicleModel_slug_idx" ON "VehicleModel"("slug");

-- CreateIndex
CREATE INDEX "VehicleModel_makeId_idx" ON "VehicleModel"("makeId");

-- CreateIndex
CREATE UNIQUE INDEX "VehicleModel_makeId_slug_key" ON "VehicleModel"("makeId", "slug");

-- CreateIndex
CREATE INDEX "VehicleVariant_slug_idx" ON "VehicleVariant"("slug");

-- CreateIndex
CREATE INDEX "VehicleVariant_modelId_idx" ON "VehicleVariant"("modelId");

-- CreateIndex
CREATE UNIQUE INDEX "VehicleVariant_modelId_slug_key" ON "VehicleVariant"("modelId", "slug");

-- AddForeignKey
ALTER TABLE "VehicleModel" ADD CONSTRAINT "VehicleModel_makeId_fkey" FOREIGN KEY ("makeId") REFERENCES "VehicleMake"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleVariant" ADD CONSTRAINT "VehicleVariant_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "VehicleModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Exclusion constraint: prevent overlapping year ranges per (modelId, name)
ALTER TABLE "VehicleVariant"
ADD CONSTRAINT no_overlapping_year_ranges
EXCLUDE USING gist (
  "modelId" WITH =,
  "name" WITH =,
  int4range("yearFrom", "yearTo" + 1) WITH &&
);

-- Check constraint: yearTo must be >= yearFrom
ALTER TABLE "VehicleVariant"
ADD CONSTRAINT year_range_valid CHECK ("yearTo" >= "yearFrom");
