-- CreateEnum
CREATE TYPE "CaravanVariantStatus" AS ENUM ('CATALOGUE', 'COMMUNITY');

-- AlterTable: add status + communitySubmitterId, and relax geometry/capacity to nullable
ALTER TABLE "CaravanVariant"
  ADD COLUMN "status" "CaravanVariantStatus" NOT NULL DEFAULT 'CATALOGUE',
  ADD COLUMN "communitySubmitterId" TEXT,
  ALTER COLUMN "atmKg" DROP NOT NULL,
  ALTER COLUMN "gtmKg" DROP NOT NULL,
  ALTER COLUMN "tareKg" DROP NOT NULL,
  ALTER COLUMN "tbmKg" DROP NOT NULL,
  ALTER COLUMN "couplingToAxleMm" DROP NOT NULL,
  ALTER COLUMN "bodyLengthMm" DROP NOT NULL,
  ALTER COLUMN "overallLengthMm" DROP NOT NULL,
  ALTER COLUMN "freshWaterCapacityL" DROP NOT NULL,
  ALTER COLUMN "greyWaterCapacityL" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "CaravanVariant_status_communitySubmitterId_idx" ON "CaravanVariant"("status", "communitySubmitterId");

-- AddForeignKey
ALTER TABLE "CaravanVariant" ADD CONSTRAINT "CaravanVariant_communitySubmitterId_fkey" FOREIGN KEY ("communitySubmitterId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
