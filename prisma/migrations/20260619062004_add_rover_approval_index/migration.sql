-- CreateEnum
CREATE TYPE "RoverIndexExpandState" AS ENUM ('UNFETCHED', 'EXPANDED', 'SKIPPED');

-- CreateTable
CREATE TABLE "RoverApprovalIndex" (
    "id" TEXT NOT NULL,
    "vtaNumber" TEXT NOT NULL,
    "approvalId" TEXT NOT NULL,
    "make" TEXT,
    "model" TEXT,
    "category" TEXT,
    "lastUpdated" TIMESTAMP(3),
    "expandState" "RoverIndexExpandState" NOT NULL DEFAULT 'UNFETCHED',
    "resultingModelId" TEXT,
    "raw" JSONB,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoverApprovalIndex_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RoverApprovalIndex_vtaNumber_key" ON "RoverApprovalIndex"("vtaNumber");

-- CreateIndex
CREATE INDEX "RoverApprovalIndex_make_idx" ON "RoverApprovalIndex"("make");

-- CreateIndex
CREATE INDEX "RoverApprovalIndex_category_idx" ON "RoverApprovalIndex"("category");

-- CreateIndex
CREATE INDEX "RoverApprovalIndex_expandState_idx" ON "RoverApprovalIndex"("expandState");
