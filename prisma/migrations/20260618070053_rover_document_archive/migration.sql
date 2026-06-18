-- CreateEnum
CREATE TYPE "RoverDocType" AS ENUM ('RVD', 'APPROVAL_NOTICE');

-- CreateTable
CREATE TABLE "RoverDocument" (
    "id" TEXT NOT NULL,
    "vtaNumber" TEXT NOT NULL,
    "docType" "RoverDocType" NOT NULL,
    "contentHash" TEXT NOT NULL,
    "fileName" TEXT,
    "make" TEXT,
    "model" TEXT,
    "categoryBroad" TEXT,
    "categoryFine" TEXT,
    "generatedDate" TEXT,
    "validFrom" TEXT,
    "variationValidFrom" TEXT,
    "expiresOn" TEXT,
    "rawText" TEXT NOT NULL,
    "parsed" JSONB NOT NULL,
    "variantCount" INTEGER NOT NULL DEFAULT 0,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoverDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RoverDocument_vtaNumber_idx" ON "RoverDocument"("vtaNumber");

-- CreateIndex
CREATE INDEX "RoverDocument_docType_idx" ON "RoverDocument"("docType");

-- CreateIndex
CREATE UNIQUE INDEX "RoverDocument_vtaNumber_docType_contentHash_key" ON "RoverDocument"("vtaNumber", "docType", "contentHash");
