-- AlterTable
ALTER TABLE "Setup" ADD COLUMN "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Set NOT NULL after adding default
ALTER TABLE "Setup" ALTER COLUMN "tags" SET NOT NULL;
ALTER TABLE "Setup" ALTER COLUMN "tags" DROP DEFAULT;
