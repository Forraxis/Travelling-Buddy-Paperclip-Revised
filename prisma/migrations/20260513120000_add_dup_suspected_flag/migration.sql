-- AddColumn: dupSuspected flag on all three submission tables
-- Set when the user asserts their submission is different from a flagged duplicate (moderators see this in Phase 11 UI)

ALTER TABLE "VehicleSubmission" ADD COLUMN "dupSuspected" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "CaravanSubmission" ADD COLUMN "dupSuspected" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "AccessorySubmission" ADD COLUMN "dupSuspected" BOOLEAN NOT NULL DEFAULT false;
