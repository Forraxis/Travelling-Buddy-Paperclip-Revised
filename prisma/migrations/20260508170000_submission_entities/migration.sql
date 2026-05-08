-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "VehicleSubmission" (
    "id" TEXT NOT NULL,
    "submitterId" TEXT NOT NULL,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'PENDING',
    "submittedData" JSONB NOT NULL,
    "compliancePlatePhotoUrl" TEXT,
    "additionalPhotoUrls" TEXT[],
    "notes" TEXT,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionNotes" TEXT,
    "resultingVariantId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VehicleSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaravanSubmission" (
    "id" TEXT NOT NULL,
    "submitterId" TEXT NOT NULL,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'PENDING',
    "submittedData" JSONB NOT NULL,
    "compliancePlatePhotoUrl" TEXT,
    "additionalPhotoUrls" TEXT[],
    "notes" TEXT,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionNotes" TEXT,
    "resultingVariantId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CaravanSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccessorySubmission" (
    "id" TEXT NOT NULL,
    "submitterId" TEXT NOT NULL,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'PENDING',
    "brandId" TEXT,
    "categoryId" TEXT,
    "submittedData" JSONB NOT NULL,
    "productPhotoUrl" TEXT,
    "installationPhotoUrl" TEXT,
    "appliesToVehicleVariantId" TEXT,
    "appliesToCaravanVariantId" TEXT,
    "notes" TEXT,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionNotes" TEXT,
    "resultingAccessoryId" TEXT,
    "resultingFitmentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccessorySubmission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VehicleSubmission_status_idx" ON "VehicleSubmission"("status");

-- CreateIndex
CREATE INDEX "VehicleSubmission_submitterId_idx" ON "VehicleSubmission"("submitterId");

-- CreateIndex
CREATE INDEX "CaravanSubmission_status_idx" ON "CaravanSubmission"("status");

-- CreateIndex
CREATE INDEX "CaravanSubmission_submitterId_idx" ON "CaravanSubmission"("submitterId");

-- CreateIndex
CREATE INDEX "AccessorySubmission_status_idx" ON "AccessorySubmission"("status");

-- CreateIndex
CREATE INDEX "AccessorySubmission_submitterId_idx" ON "AccessorySubmission"("submitterId");

-- CreateIndex
CREATE INDEX "AccessorySubmission_brandId_idx" ON "AccessorySubmission"("brandId");

-- CreateIndex
CREATE INDEX "AccessorySubmission_categoryId_idx" ON "AccessorySubmission"("categoryId");

-- AddForeignKey
ALTER TABLE "VehicleSubmission" ADD CONSTRAINT "VehicleSubmission_submitterId_fkey" FOREIGN KEY ("submitterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleSubmission" ADD CONSTRAINT "VehicleSubmission_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleSubmission" ADD CONSTRAINT "VehicleSubmission_resultingVariantId_fkey" FOREIGN KEY ("resultingVariantId") REFERENCES "VehicleVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaravanSubmission" ADD CONSTRAINT "CaravanSubmission_submitterId_fkey" FOREIGN KEY ("submitterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaravanSubmission" ADD CONSTRAINT "CaravanSubmission_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaravanSubmission" ADD CONSTRAINT "CaravanSubmission_resultingVariantId_fkey" FOREIGN KEY ("resultingVariantId") REFERENCES "CaravanVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessorySubmission" ADD CONSTRAINT "AccessorySubmission_submitterId_fkey" FOREIGN KEY ("submitterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessorySubmission" ADD CONSTRAINT "AccessorySubmission_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessorySubmission" ADD CONSTRAINT "AccessorySubmission_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "AccessoryBrand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessorySubmission" ADD CONSTRAINT "AccessorySubmission_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "AccessoryCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessorySubmission" ADD CONSTRAINT "AccessorySubmission_appliesToVehicleVariantId_fkey" FOREIGN KEY ("appliesToVehicleVariantId") REFERENCES "VehicleVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessorySubmission" ADD CONSTRAINT "AccessorySubmission_appliesToCaravanVariantId_fkey" FOREIGN KEY ("appliesToCaravanVariantId") REFERENCES "CaravanVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessorySubmission" ADD CONSTRAINT "AccessorySubmission_resultingAccessoryId_fkey" FOREIGN KEY ("resultingAccessoryId") REFERENCES "Accessory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessorySubmission" ADD CONSTRAINT "AccessorySubmission_resultingFitmentId_fkey" FOREIGN KEY ("resultingFitmentId") REFERENCES "AccessoryFitment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
