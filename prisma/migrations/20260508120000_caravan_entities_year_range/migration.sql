-- CreateEnum
CREATE TYPE "CaravanBodyType" AS ENUM ('CARAVAN_POP_TOP', 'CARAVAN_FULL_HEIGHT', 'OFF_ROAD_CARAVAN', 'CAMPER_TRAILER', 'HYBRID', 'FIFTH_WHEELER', 'OTHER');

-- CreateEnum
CREATE TYPE "AxleConfiguration" AS ENUM ('SINGLE_AXLE', 'DUAL_AXLE_CLOSE_COUPLED', 'DUAL_AXLE_SPREAD', 'TRIPLE_AXLE');

-- CreateTable
CREATE TABLE "CaravanMake" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logoUrl" TEXT,
    "countryOfOrigin" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CaravanMake_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaravanModel" (
    "id" TEXT NOT NULL,
    "makeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "bodyType" "CaravanBodyType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CaravanModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaravanVariant" (
    "id" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "yearFrom" INTEGER NOT NULL,
    "yearTo" INTEGER NOT NULL,
    "isCurrentProduction" BOOLEAN NOT NULL DEFAULT false,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "atmKg" INTEGER NOT NULL,
    "gtmKg" INTEGER NOT NULL,
    "tareKg" INTEGER NOT NULL,
    "tbmKg" INTEGER NOT NULL,
    "axleConfiguration" "AxleConfiguration" NOT NULL,
    "couplingToAxleMm" INTEGER NOT NULL,
    "axleSpacingMm" INTEGER,
    "bodyLengthMm" INTEGER NOT NULL,
    "overallLengthMm" INTEGER NOT NULL,
    "freshWaterCapacityL" INTEGER NOT NULL,
    "greyWaterCapacityL" INTEGER NOT NULL,
    "gasBottleConfig" TEXT,
    "market" "Market" NOT NULL DEFAULT 'AU',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CaravanVariant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CaravanMake_name_key" ON "CaravanMake"("name");

-- CreateIndex
CREATE UNIQUE INDEX "CaravanMake_slug_key" ON "CaravanMake"("slug");

-- CreateIndex
CREATE INDEX "CaravanMake_slug_idx" ON "CaravanMake"("slug");

-- CreateIndex
CREATE INDEX "CaravanModel_slug_idx" ON "CaravanModel"("slug");

-- CreateIndex
CREATE INDEX "CaravanModel_makeId_idx" ON "CaravanModel"("makeId");

-- CreateIndex
CREATE UNIQUE INDEX "CaravanModel_makeId_slug_key" ON "CaravanModel"("makeId", "slug");

-- CreateIndex
CREATE INDEX "CaravanVariant_slug_idx" ON "CaravanVariant"("slug");

-- CreateIndex
CREATE INDEX "CaravanVariant_modelId_idx" ON "CaravanVariant"("modelId");

-- CreateIndex
CREATE UNIQUE INDEX "CaravanVariant_modelId_slug_key" ON "CaravanVariant"("modelId", "slug");

-- AddForeignKey
ALTER TABLE "CaravanModel" ADD CONSTRAINT "CaravanModel_makeId_fkey" FOREIGN KEY ("makeId") REFERENCES "CaravanMake"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaravanVariant" ADD CONSTRAINT "CaravanVariant_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "CaravanModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Exclusion constraint: prevent overlapping year ranges per (modelId, name)
ALTER TABLE "CaravanVariant"
ADD CONSTRAINT no_overlapping_caravan_year_ranges
EXCLUDE USING gist (
  "modelId" WITH =,
  "name" WITH =,
  int4range("yearFrom", "yearTo" + 1) WITH &&
);

-- Check constraint: yearTo must be >= yearFrom
ALTER TABLE "CaravanVariant"
ADD CONSTRAINT caravan_year_range_valid CHECK ("yearTo" >= "yearFrom");
