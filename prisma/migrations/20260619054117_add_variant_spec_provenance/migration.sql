-- CreateEnum
CREATE TYPE "SpecProvenanceSource" AS ENUM ('ROVER', 'CLAUDE', 'PLATE', 'COMMUNITY', 'MANUAL');

-- CreateEnum
CREATE TYPE "SpecProvenanceStatus" AS ENUM ('CONFIRMED', 'ESTIMATE', 'DISPUTED');

-- CreateTable
CREATE TABLE "VariantSpecProvenance" (
    "id" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "value" TEXT,
    "source" "SpecProvenanceSource" NOT NULL,
    "status" "SpecProvenanceStatus" NOT NULL DEFAULT 'ESTIMATE',
    "confidence" "SpecFieldConfidence",
    "sourceUrl" TEXT,
    "corroboratingCount" INTEGER NOT NULL DEFAULT 0,
    "asOf" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VariantSpecProvenance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VariantSpecProvenance_variantId_idx" ON "VariantSpecProvenance"("variantId");

-- CreateIndex
CREATE INDEX "VariantSpecProvenance_field_idx" ON "VariantSpecProvenance"("field");

-- CreateIndex
CREATE INDEX "VariantSpecProvenance_status_idx" ON "VariantSpecProvenance"("status");

-- CreateIndex
CREATE UNIQUE INDEX "VariantSpecProvenance_variantId_field_key" ON "VariantSpecProvenance"("variantId", "field");

-- AddForeignKey
ALTER TABLE "VariantSpecProvenance" ADD CONSTRAINT "VariantSpecProvenance_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "VehicleVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
