-- AlterEnum (rename RegulationSet -> RegulationSetCode)
ALTER TYPE "RegulationSet" RENAME TO "RegulationSetCode";

-- CreateEnum
CREATE TYPE "SponsorStatus" AS ENUM ('ACTIVE', 'PAUSED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "PlacementType" AS ENUM ('ACCESSORY_FEATURED', 'CATEGORY_TOP', 'RECOMMENDATION_PINNED', 'VEHICLE_TYPE_FEATURED');

-- CreateEnum
CREATE TYPE "PlacementTier" AS ENUM ('FEATURED_FIT', 'CATEGORY_TOP', 'RECOMMENDATION_PINNED');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE');

-- CreateEnum
CREATE TYPE "ModerationActionType" AS ENUM ('APPROVE', 'REJECT', 'REQUEST_INFO');

-- CreateTable
CREATE TABLE "Sponsor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactName" TEXT,
    "contactEmail" TEXT,
    "billingReference" TEXT,
    "status" "SponsorStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sponsor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SponsoredPlacement" (
    "id" TEXT NOT NULL,
    "sponsorId" TEXT NOT NULL,
    "placementType" "PlacementType" NOT NULL,
    "accessoryId" TEXT,
    "categoryId" TEXT,
    "vehicleBodyType" "VehicleBodyType",
    "stateFilter" "AustralianState",
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "tier" "PlacementTier" NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SponsoredPlacement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegulationSet" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentSetCode" TEXT,
    "rules" JSONB NOT NULL DEFAULT '{}',
    "market" "Market" NOT NULL DEFAULT 'AU',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RegulationSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" "AuditAction" NOT NULL,
    "changedBy" TEXT NOT NULL,
    "changes" JSONB NOT NULL DEFAULT '{}',
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModerationAction" (
    "id" TEXT NOT NULL,
    "submissionType" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "moderatorId" TEXT NOT NULL,
    "action" "ModerationActionType" NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModerationAction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Sponsor_name_key" ON "Sponsor"("name");

-- CreateIndex
CREATE INDEX "Sponsor_status_idx" ON "Sponsor"("status");

-- CreateIndex
CREATE INDEX "SponsoredPlacement_sponsorId_idx" ON "SponsoredPlacement"("sponsorId");

-- CreateIndex
CREATE INDEX "SponsoredPlacement_placementType_idx" ON "SponsoredPlacement"("placementType");

-- CreateIndex
CREATE INDEX "SponsoredPlacement_startsAt_endsAt_idx" ON "SponsoredPlacement"("startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "SponsoredPlacement_accessoryId_idx" ON "SponsoredPlacement"("accessoryId");

-- CreateIndex
CREATE INDEX "SponsoredPlacement_categoryId_idx" ON "SponsoredPlacement"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "RegulationSet_code_key" ON "RegulationSet"("code");

-- CreateIndex
CREATE INDEX "RegulationSet_parentSetCode_idx" ON "RegulationSet"("parentSetCode");

-- CreateIndex
CREATE INDEX "RegulationSet_market_idx" ON "RegulationSet"("market");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_changedBy_idx" ON "AuditLog"("changedBy");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "ModerationAction_submissionType_submissionId_idx" ON "ModerationAction"("submissionType", "submissionId");

-- CreateIndex
CREATE INDEX "ModerationAction_moderatorId_idx" ON "ModerationAction"("moderatorId");

-- CreateIndex
CREATE INDEX "ModerationAction_action_idx" ON "ModerationAction"("action");

-- CreateIndex
CREATE INDEX "ModerationAction_createdAt_idx" ON "ModerationAction"("createdAt");

-- AddForeignKey
ALTER TABLE "SponsoredPlacement" ADD CONSTRAINT "SponsoredPlacement_sponsorId_fkey" FOREIGN KEY ("sponsorId") REFERENCES "Sponsor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SponsoredPlacement" ADD CONSTRAINT "SponsoredPlacement_accessoryId_fkey" FOREIGN KEY ("accessoryId") REFERENCES "Accessory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SponsoredPlacement" ADD CONSTRAINT "SponsoredPlacement_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "AccessoryCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegulationSet" ADD CONSTRAINT "RegulationSet_parentSetCode_fkey" FOREIGN KEY ("parentSetCode") REFERENCES "RegulationSet"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_changedBy_fkey" FOREIGN KEY ("changedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationAction" ADD CONSTRAINT "ModerationAction_moderatorId_fkey" FOREIGN KEY ("moderatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
