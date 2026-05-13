-- Phase 10: Add DRAFT/DEFERRED to SubmissionStatus; add VLM/OCR fields and
-- duplicate-detection columns to VehicleSubmission, CaravanSubmission, and
-- AccessorySubmission; add isShared and draftExpiresAt across all three.

-- Extend the SubmissionStatus enum with DRAFT and DEFERRED values.
-- Postgres requires adding enum values before using them in ALTER TABLE.
ALTER TYPE "SubmissionStatus" ADD VALUE IF NOT EXISTS 'DRAFT';
ALTER TYPE "SubmissionStatus" ADD VALUE IF NOT EXISTS 'DEFERRED';

-- VehicleSubmission additions
ALTER TABLE "VehicleSubmission"
  ALTER COLUMN "status" SET DEFAULT 'DRAFT',
  ADD COLUMN IF NOT EXISTS "ocrData"              JSONB,
  ADD COLUMN IF NOT EXISTS "vlmExtractionResult"  JSONB,
  ADD COLUMN IF NOT EXISTS "vlmGatekeeperResult"  JSONB,
  ADD COLUMN IF NOT EXISTS "vlmJobId"             TEXT,
  ADD COLUMN IF NOT EXISTS "duplicateFingerprint" TEXT,
  ADD COLUMN IF NOT EXISTS "suspectedDuplicateOfId" TEXT,
  ADD COLUMN IF NOT EXISTS "draftExpiresAt"       TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "VehicleSubmission_duplicateFingerprint_idx"
  ON "VehicleSubmission"("duplicateFingerprint");

-- CaravanSubmission additions
ALTER TABLE "CaravanSubmission"
  ALTER COLUMN "status" SET DEFAULT 'DRAFT',
  ADD COLUMN IF NOT EXISTS "ocrData"              JSONB,
  ADD COLUMN IF NOT EXISTS "vlmExtractionResult"  JSONB,
  ADD COLUMN IF NOT EXISTS "vlmGatekeeperResult"  JSONB,
  ADD COLUMN IF NOT EXISTS "vlmJobId"             TEXT,
  ADD COLUMN IF NOT EXISTS "duplicateFingerprint" TEXT,
  ADD COLUMN IF NOT EXISTS "suspectedDuplicateOfId" TEXT,
  ADD COLUMN IF NOT EXISTS "draftExpiresAt"       TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "CaravanSubmission_duplicateFingerprint_idx"
  ON "CaravanSubmission"("duplicateFingerprint");

-- AccessorySubmission additions
ALTER TABLE "AccessorySubmission"
  ALTER COLUMN "status" SET DEFAULT 'DRAFT',
  ADD COLUMN IF NOT EXISTS "vlmSimilarityResult"  JSONB,
  ADD COLUMN IF NOT EXISTS "vlmJobId"             TEXT,
  ADD COLUMN IF NOT EXISTS "duplicateFingerprint" TEXT,
  ADD COLUMN IF NOT EXISTS "suspectedDuplicateOfId" TEXT,
  ADD COLUMN IF NOT EXISTS "isShared"             BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "draftExpiresAt"       TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "AccessorySubmission_duplicateFingerprint_idx"
  ON "AccessorySubmission"("duplicateFingerprint");
