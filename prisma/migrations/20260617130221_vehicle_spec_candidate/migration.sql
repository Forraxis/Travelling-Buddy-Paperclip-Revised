-- CreateEnum
CREATE TYPE "SpecFieldConfidence" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "SpecFetchProvider" AS ENUM ('MOCK', 'QWEN', 'CLAUDE', 'ADMIN');

-- CreateTable
CREATE TABLE "VehicleSpecCandidate" (
    "id" TEXT NOT NULL,
    "makeName" TEXT NOT NULL,
    "modelName" TEXT NOT NULL,
    "variantName" TEXT,
    "yearFrom" INTEGER NOT NULL,
    "yearTo" INTEGER,
    "bodyType" "VehicleBodyType",
    "market" "Market" NOT NULL DEFAULT 'AU',
    "provider" "SpecFetchProvider" NOT NULL,
    "providerModel" TEXT,
    "promptVersion" TEXT,
    "rawResponse" JSONB,
    "fetchError" TEXT,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'PENDING',
    "fetchJobId" TEXT,
    "criticalOverrideById" TEXT,
    "criticalOverrideAt" TIMESTAMP(3),
    "criticalOverrideNote" TEXT,
    "resultingVariantId" TEXT,
    "createdById" TEXT,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VehicleSpecCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleSpecCandidateField" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "value" TEXT,
    "confidence" "SpecFieldConfidence",
    "sourceUrl" TEXT,
    "provider" "SpecFetchProvider" NOT NULL,
    "isComplianceCritical" BOOLEAN NOT NULL DEFAULT false,
    "adminValue" TEXT,
    "corroborated" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,

    CONSTRAINT "VehicleSpecCandidateField_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VehicleSpecCandidate_status_idx" ON "VehicleSpecCandidate"("status");

-- CreateIndex
CREATE INDEX "VehicleSpecCandidate_resultingVariantId_idx" ON "VehicleSpecCandidate"("resultingVariantId");

-- CreateIndex
CREATE INDEX "VehicleSpecCandidate_makeName_modelName_idx" ON "VehicleSpecCandidate"("makeName", "modelName");

-- CreateIndex
CREATE INDEX "VehicleSpecCandidate_createdById_idx" ON "VehicleSpecCandidate"("createdById");

-- CreateIndex
CREATE INDEX "VehicleSpecCandidateField_candidateId_idx" ON "VehicleSpecCandidateField"("candidateId");

-- CreateIndex
CREATE UNIQUE INDEX "VehicleSpecCandidateField_candidateId_field_key" ON "VehicleSpecCandidateField"("candidateId", "field");

-- AddForeignKey
ALTER TABLE "VehicleSpecCandidate" ADD CONSTRAINT "VehicleSpecCandidate_resultingVariantId_fkey" FOREIGN KEY ("resultingVariantId") REFERENCES "VehicleVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleSpecCandidate" ADD CONSTRAINT "VehicleSpecCandidate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleSpecCandidate" ADD CONSTRAINT "VehicleSpecCandidate_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleSpecCandidate" ADD CONSTRAINT "VehicleSpecCandidate_criticalOverrideById_fkey" FOREIGN KEY ("criticalOverrideById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleSpecCandidateField" ADD CONSTRAINT "VehicleSpecCandidateField_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "VehicleSpecCandidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
