-- CreateEnum
CREATE TYPE "RoverNormalizationStatus" AS ENUM ('UNPROCESSED', 'AUTO', 'NEEDS_REVIEW', 'MANUAL');

-- AlterTable
ALTER TABLE "RoverApprovalIndex" ADD COLUMN     "baseMake" TEXT,
ADD COLUMN     "baseModel" TEXT,
ADD COLUMN     "isSecondStage" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "modifier" TEXT,
ADD COLUMN     "normalizationStatus" "RoverNormalizationStatus" NOT NULL DEFAULT 'UNPROCESSED';

-- CreateIndex
CREATE INDEX "RoverApprovalIndex_baseMake_baseModel_idx" ON "RoverApprovalIndex"("baseMake", "baseModel");

-- CreateIndex
CREATE INDEX "RoverApprovalIndex_normalizationStatus_idx" ON "RoverApprovalIndex"("normalizationStatus");
