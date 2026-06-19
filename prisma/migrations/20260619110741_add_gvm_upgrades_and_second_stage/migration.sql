-- CreateEnum
CREATE TYPE "RoverSecondStageType" AS ENUM ('NONE', 'GVM_UPGRADE', 'CONVERSION', 'MOTORHOME', 'OTHER');

-- CreateEnum
CREATE TYPE "GvmUpgradePathway" AS ENUM ('PRE_REGO_SECOND_STAGE', 'POST_REGO_SSM', 'STATE_ENGINEER');

-- AlterTable
ALTER TABLE "RoverApprovalIndex" ADD COLUMN     "secondStageType" "RoverSecondStageType" NOT NULL DEFAULT 'NONE';

-- AlterTable
ALTER TABLE "Setup" ADD COLUMN     "appliedGvmUpgradeId" TEXT,
ADD COLUMN     "customGvmUpgrade" JSONB;

-- CreateTable
CREATE TABLE "GvmUpgrade" (
    "id" TEXT NOT NULL,
    "baseVariantId" TEXT NOT NULL,
    "modifierName" TEXT NOT NULL,
    "pathway" "GvmUpgradePathway" NOT NULL,
    "vtaNumber" TEXT,
    "engineerRef" TEXT,
    "gvmKg" INTEGER,
    "gcmKg" INTEGER,
    "frontAxleLimitKg" INTEGER,
    "rearAxleLimitKg" INTEGER,
    "maxTowingKg" INTEGER,
    "addedMassKg" INTEGER,
    "isPreRego" BOOLEAN NOT NULL DEFAULT false,
    "certifiedState" "AustralianState",
    "status" "VehicleVariantStatus" NOT NULL DEFAULT 'CATALOGUE',
    "sourceUrl" TEXT,
    "sourceVtaNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GvmUpgrade_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GvmUpgrade_baseVariantId_idx" ON "GvmUpgrade"("baseVariantId");

-- CreateIndex
CREATE INDEX "RoverApprovalIndex_secondStageType_idx" ON "RoverApprovalIndex"("secondStageType");

-- CreateIndex
CREATE INDEX "Setup_appliedGvmUpgradeId_idx" ON "Setup"("appliedGvmUpgradeId");

-- AddForeignKey
ALTER TABLE "GvmUpgrade" ADD CONSTRAINT "GvmUpgrade_baseVariantId_fkey" FOREIGN KEY ("baseVariantId") REFERENCES "VehicleVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Setup" ADD CONSTRAINT "Setup_appliedGvmUpgradeId_fkey" FOREIGN KEY ("appliedGvmUpgradeId") REFERENCES "GvmUpgrade"("id") ON DELETE SET NULL ON UPDATE CASCADE;
