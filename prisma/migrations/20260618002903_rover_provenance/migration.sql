-- AlterEnum
ALTER TYPE "SpecFetchProvider" ADD VALUE 'ROVER';

-- AlterTable
ALTER TABLE "VehicleSpecCandidate" ADD COLUMN     "sourceReportUrl" TEXT,
ADD COLUMN     "sourceVtaNumber" TEXT;

-- CreateIndex
CREATE INDEX "VehicleSpecCandidate_sourceVtaNumber_idx" ON "VehicleSpecCandidate"("sourceVtaNumber");
