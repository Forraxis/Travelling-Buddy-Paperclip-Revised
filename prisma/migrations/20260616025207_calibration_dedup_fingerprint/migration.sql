-- AlterTable
ALTER TABLE "CalibrationContribution" ADD COLUMN     "duplicateFingerprint" TEXT;

-- CreateIndex
CREATE INDEX "CalibrationContribution_vehicleVariantId_duplicateFingerpri_idx" ON "CalibrationContribution"("vehicleVariantId", "duplicateFingerprint", "status");
