-- CreateTable
CREATE TABLE "FitmentPositionSubmission" (
    "id" TEXT NOT NULL,
    "submitterId" TEXT,
    "fitmentId" TEXT NOT NULL,
    "vehicleVariantId" TEXT,
    "caravanVariantId" TEXT,
    "cogXMm" INTEGER NOT NULL,
    "cogYMm" INTEGER NOT NULL,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'PENDING',
    "source" TEXT,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FitmentPositionSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FitmentPositionSubmission_status_idx" ON "FitmentPositionSubmission"("status");

-- CreateIndex
CREATE INDEX "FitmentPositionSubmission_fitmentId_status_idx" ON "FitmentPositionSubmission"("fitmentId", "status");

-- CreateIndex
CREATE INDEX "FitmentPositionSubmission_vehicleVariantId_idx" ON "FitmentPositionSubmission"("vehicleVariantId");

-- CreateIndex
CREATE INDEX "FitmentPositionSubmission_submitterId_idx" ON "FitmentPositionSubmission"("submitterId");

-- AddForeignKey
ALTER TABLE "FitmentPositionSubmission" ADD CONSTRAINT "FitmentPositionSubmission_submitterId_fkey" FOREIGN KEY ("submitterId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FitmentPositionSubmission" ADD CONSTRAINT "FitmentPositionSubmission_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FitmentPositionSubmission" ADD CONSTRAINT "FitmentPositionSubmission_fitmentId_fkey" FOREIGN KEY ("fitmentId") REFERENCES "AccessoryFitment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FitmentPositionSubmission" ADD CONSTRAINT "FitmentPositionSubmission_vehicleVariantId_fkey" FOREIGN KEY ("vehicleVariantId") REFERENCES "VehicleVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FitmentPositionSubmission" ADD CONSTRAINT "FitmentPositionSubmission_caravanVariantId_fkey" FOREIGN KEY ("caravanVariantId") REFERENCES "CaravanVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
