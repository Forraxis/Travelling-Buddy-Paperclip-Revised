-- CreateEnum
CREATE TYPE "WeighbridgeGranularity" AS ENUM ('TOTAL', 'AXLE', 'CORNER', 'TOWBALL');

-- AlterTable
ALTER TABLE "SetupCustomLoad" ADD COLUMN     "isUnaccounted" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "WeighbridgeMeasurement" (
    "id" TEXT NOT NULL,
    "setupId" TEXT NOT NULL,
    "granularity" "WeighbridgeGranularity" NOT NULL,
    "totalKg" DECIMAL(8,2),
    "frontAxleKg" DECIMAL(8,2),
    "rearAxleKg" DECIMAL(8,2),
    "cornerFlKg" DECIMAL(8,2),
    "cornerFrKg" DECIMAL(8,2),
    "cornerRlKg" DECIMAL(8,2),
    "cornerRrKg" DECIMAL(8,2),
    "towBallKg" DECIMAL(8,2),
    "preferStaticOnly" BOOLEAN NOT NULL DEFAULT false,
    "staticOffsets" JSONB NOT NULL DEFAULT '{}',
    "weighedSnapshot" JSONB,
    "notes" TEXT,
    "measuredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeighbridgeMeasurement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WeighbridgeMeasurement_setupId_idx" ON "WeighbridgeMeasurement"("setupId");

-- AddForeignKey
ALTER TABLE "WeighbridgeMeasurement" ADD CONSTRAINT "WeighbridgeMeasurement_setupId_fkey" FOREIGN KEY ("setupId") REFERENCES "Setup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
