-- CreateEnum
CREATE TYPE "QldNormStatus" AS ENUM ('AUTO', 'NEEDS_REVIEW', 'JUNK');

-- AlterTable
ALTER TABLE "QldFleetVehicle" ADD COLUMN     "canonicalMake" TEXT,
ADD COLUMN     "canonicalModel" TEXT,
ADD COLUMN     "normStatus" "QldNormStatus" NOT NULL DEFAULT 'NEEDS_REVIEW',
ADD COLUMN     "roverMatched" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "QldFleetVehicle_normStatus_idx" ON "QldFleetVehicle"("normStatus");

-- CreateIndex
CREATE INDEX "QldFleetVehicle_canonicalMake_canonicalModel_idx" ON "QldFleetVehicle"("canonicalMake", "canonicalModel");
