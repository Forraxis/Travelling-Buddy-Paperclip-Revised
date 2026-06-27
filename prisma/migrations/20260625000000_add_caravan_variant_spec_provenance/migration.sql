-- Baseline migration for CaravanVariantSpecProvenance.
-- This table was originally created via `db push` and never had a migration
-- (the drift hole noted in CARAVAN_DATA_SOURCES.md §8). The table already exists
-- on the shared remote, so this migration is marked applied via
-- `prisma migrate resolve --applied` rather than re-run there; it exists so a
-- fresh `prisma migrate deploy` (CI / new dev DB) creates the table correctly.

-- CreateTable
CREATE TABLE "CaravanVariantSpecProvenance" (
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

    CONSTRAINT "CaravanVariantSpecProvenance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CaravanVariantSpecProvenance_variantId_idx" ON "CaravanVariantSpecProvenance"("variantId");

-- CreateIndex
CREATE INDEX "CaravanVariantSpecProvenance_field_idx" ON "CaravanVariantSpecProvenance"("field");

-- CreateIndex
CREATE INDEX "CaravanVariantSpecProvenance_status_idx" ON "CaravanVariantSpecProvenance"("status");

-- CreateIndex
CREATE UNIQUE INDEX "CaravanVariantSpecProvenance_variantId_field_key" ON "CaravanVariantSpecProvenance"("variantId", "field");

-- AddForeignKey
ALTER TABLE "CaravanVariantSpecProvenance" ADD CONSTRAINT "CaravanVariantSpecProvenance_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "CaravanVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
