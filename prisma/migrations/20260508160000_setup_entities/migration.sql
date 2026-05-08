-- CreateEnum
CREATE TYPE "RegulationSet" AS ENUM ('AU_ADR', 'NZ_VIRM', 'US_FMVSS', 'EU_UNECE', 'GB_IVA');

-- CreateTable
CREATE TABLE "Setup" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "vehicleVariantId" TEXT,
    "caravanVariantId" TEXT,
    "passengers" INTEGER NOT NULL DEFAULT 2,
    "cargoKg" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "fuelPercent" INTEGER NOT NULL DEFAULT 100,
    "freshWaterPercent" INTEGER NOT NULL DEFAULT 100,
    "greyWaterPercent" INTEGER NOT NULL DEFAULT 0,
    "calibrationOverrides" JSONB NOT NULL DEFAULT '{}',
    "shareToken" TEXT NOT NULL,
    "regulationSetCode" "RegulationSet" NOT NULL DEFAULT 'AU_ADR',
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Setup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SetupAccessory" (
    "id" TEXT NOT NULL,
    "setupId" TEXT NOT NULL,
    "fitmentId" TEXT NOT NULL,
    "parentId" TEXT,
    "quantityOverride" INTEGER NOT NULL DEFAULT 1,
    "fillPercent" INTEGER NOT NULL DEFAULT 100,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SetupAccessory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SetupCaravanAccessory" (
    "id" TEXT NOT NULL,
    "setupId" TEXT NOT NULL,
    "fitmentId" TEXT NOT NULL,
    "parentId" TEXT,
    "quantityOverride" INTEGER NOT NULL DEFAULT 1,
    "fillPercent" INTEGER NOT NULL DEFAULT 100,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SetupCaravanAccessory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SetupCustomLoad" (
    "id" TEXT NOT NULL,
    "setupId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "weightKg" DECIMAL(8,2) NOT NULL,
    "mountingLocation" "MountingLocation" NOT NULL,
    "cogXMm" INTEGER,
    "cogYMm" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SetupCustomLoad_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Setup_shareToken_key" ON "Setup"("shareToken");

-- CreateIndex
CREATE INDEX "Setup_userId_idx" ON "Setup"("userId");

-- CreateIndex
CREATE INDEX "Setup_vehicleVariantId_idx" ON "Setup"("vehicleVariantId");

-- CreateIndex
CREATE INDEX "Setup_caravanVariantId_idx" ON "Setup"("caravanVariantId");

-- CreateIndex
CREATE INDEX "Setup_shareToken_idx" ON "Setup"("shareToken");

-- CreateIndex
CREATE INDEX "Setup_deletedAt_idx" ON "Setup"("deletedAt");

-- CreateIndex
CREATE INDEX "SetupAccessory_setupId_idx" ON "SetupAccessory"("setupId");

-- CreateIndex
CREATE INDEX "SetupAccessory_fitmentId_idx" ON "SetupAccessory"("fitmentId");

-- CreateIndex
CREATE INDEX "SetupAccessory_parentId_idx" ON "SetupAccessory"("parentId");

-- CreateIndex
CREATE INDEX "SetupCaravanAccessory_setupId_idx" ON "SetupCaravanAccessory"("setupId");

-- CreateIndex
CREATE INDEX "SetupCaravanAccessory_fitmentId_idx" ON "SetupCaravanAccessory"("fitmentId");

-- CreateIndex
CREATE INDEX "SetupCaravanAccessory_parentId_idx" ON "SetupCaravanAccessory"("parentId");

-- CreateIndex
CREATE INDEX "SetupCustomLoad_setupId_idx" ON "SetupCustomLoad"("setupId");

-- AddForeignKey
ALTER TABLE "Setup" ADD CONSTRAINT "Setup_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Setup" ADD CONSTRAINT "Setup_vehicleVariantId_fkey" FOREIGN KEY ("vehicleVariantId") REFERENCES "VehicleVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Setup" ADD CONSTRAINT "Setup_caravanVariantId_fkey" FOREIGN KEY ("caravanVariantId") REFERENCES "CaravanVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SetupAccessory" ADD CONSTRAINT "SetupAccessory_setupId_fkey" FOREIGN KEY ("setupId") REFERENCES "Setup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SetupAccessory" ADD CONSTRAINT "SetupAccessory_fitmentId_fkey" FOREIGN KEY ("fitmentId") REFERENCES "AccessoryFitment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SetupAccessory" ADD CONSTRAINT "SetupAccessory_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "SetupAccessory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SetupCaravanAccessory" ADD CONSTRAINT "SetupCaravanAccessory_setupId_fkey" FOREIGN KEY ("setupId") REFERENCES "Setup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SetupCaravanAccessory" ADD CONSTRAINT "SetupCaravanAccessory_fitmentId_fkey" FOREIGN KEY ("fitmentId") REFERENCES "AccessoryFitment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SetupCaravanAccessory" ADD CONSTRAINT "SetupCaravanAccessory_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "SetupCaravanAccessory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SetupCustomLoad" ADD CONSTRAINT "SetupCustomLoad_setupId_fkey" FOREIGN KEY ("setupId") REFERENCES "Setup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

