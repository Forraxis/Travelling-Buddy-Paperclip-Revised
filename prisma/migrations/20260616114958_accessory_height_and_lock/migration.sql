-- AlterTable
ALTER TABLE "SetupAccessory" ADD COLUMN     "cogZMmOverride" INTEGER,
ADD COLUMN     "positionUnlocked" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "SetupCaravanAccessory" ADD COLUMN     "cogZMmOverride" INTEGER,
ADD COLUMN     "positionUnlocked" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "SetupCustomLoad" ADD COLUMN     "cogZMm" INTEGER;
