-- CreateTable
CREATE TABLE "CalibrationContribution" (
    "id" TEXT NOT NULL,
    "submitterId" TEXT,
    "vehicleVariantId" TEXT NOT NULL,
    "granularity" "WeighbridgeGranularity" NOT NULL,
    "measurement" JSONB NOT NULL,
    "weighedSnapshot" JSONB NOT NULL,
    "prediction" JSONB NOT NULL,
    "measuredTotalKg" DOUBLE PRECISION NOT NULL,
    "predictedTotalKg" DOUBLE PRECISION NOT NULL,
    "residualMassKg" DOUBLE PRECISION NOT NULL,
    "barenessWeight" DOUBLE PRECISION NOT NULL,
    "kerbMassDeltaKg" DOUBLE PRECISION,
    "cogFractionDelta" DOUBLE PRECISION,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'PENDING',
    "source" TEXT,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalibrationContribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleCalibrationCorrection" (
    "id" TEXT NOT NULL,
    "vehicleVariantId" TEXT NOT NULL,
    "kerbMassDeltaKg" DOUBLE PRECISION,
    "kerbMassSampleCount" INTEGER NOT NULL DEFAULT 0,
    "kerbMassApplied" BOOLEAN NOT NULL DEFAULT false,
    "cogFractionDelta" DOUBLE PRECISION,
    "cogSampleCount" INTEGER NOT NULL DEFAULT 0,
    "cogApplied" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VehicleCalibrationCorrection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CalibrationContribution_status_idx" ON "CalibrationContribution"("status");

-- CreateIndex
CREATE INDEX "CalibrationContribution_vehicleVariantId_status_idx" ON "CalibrationContribution"("vehicleVariantId", "status");

-- CreateIndex
CREATE INDEX "CalibrationContribution_submitterId_idx" ON "CalibrationContribution"("submitterId");

-- CreateIndex
CREATE UNIQUE INDEX "VehicleCalibrationCorrection_vehicleVariantId_key" ON "VehicleCalibrationCorrection"("vehicleVariantId");

-- AddForeignKey
ALTER TABLE "CalibrationContribution" ADD CONSTRAINT "CalibrationContribution_submitterId_fkey" FOREIGN KEY ("submitterId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalibrationContribution" ADD CONSTRAINT "CalibrationContribution_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalibrationContribution" ADD CONSTRAINT "CalibrationContribution_vehicleVariantId_fkey" FOREIGN KEY ("vehicleVariantId") REFERENCES "VehicleVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleCalibrationCorrection" ADD CONSTRAINT "VehicleCalibrationCorrection_vehicleVariantId_fkey" FOREIGN KEY ("vehicleVariantId") REFERENCES "VehicleVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
