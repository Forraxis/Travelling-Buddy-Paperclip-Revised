-- CreateEnum
CREATE TYPE "VehicleVariantStatus" AS ENUM ('CATALOGUE', 'COMMUNITY');

-- AlterTable
ALTER TABLE "VehicleVariant" ADD COLUMN     "communitySubmitterId" TEXT,
ADD COLUMN     "status" "VehicleVariantStatus" NOT NULL DEFAULT 'CATALOGUE',
ALTER COLUMN "gvmKg" DROP NOT NULL,
ALTER COLUMN "gcmKg" DROP NOT NULL,
ALTER COLUMN "kerbWeightKg" DROP NOT NULL,
ALTER COLUMN "maxTowingCapacityKg" DROP NOT NULL,
ALTER COLUMN "frontAxleLimitKg" DROP NOT NULL,
ALTER COLUMN "rearAxleLimitKg" DROP NOT NULL,
ALTER COLUMN "wheelbaseMm" DROP NOT NULL,
ALTER COLUMN "maxTowBallDownloadKg" DROP NOT NULL,
ALTER COLUMN "fuelTankCapacityL" DROP NOT NULL,
ALTER COLUMN "fuelType" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "VehicleVariant_status_communitySubmitterId_idx" ON "VehicleVariant"("status", "communitySubmitterId");

-- AddForeignKey
ALTER TABLE "VehicleVariant" ADD CONSTRAINT "VehicleVariant_communitySubmitterId_fkey" FOREIGN KEY ("communitySubmitterId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
