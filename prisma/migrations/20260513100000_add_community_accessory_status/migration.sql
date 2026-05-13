-- Phase 10.3: Add COMMUNITY status to AccessoryStatus for fast-path community submissions.
-- Community accessories are created immediately at submission time and are visible only to
-- the submitter until a moderator approves them (at which point status -> ACTIVE).
ALTER TYPE "AccessoryStatus" ADD VALUE IF NOT EXISTS 'COMMUNITY';
