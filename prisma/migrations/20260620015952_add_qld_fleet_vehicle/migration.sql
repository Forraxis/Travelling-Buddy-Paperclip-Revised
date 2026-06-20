-- CreateTable
CREATE TABLE "QldFleetVehicle" (
    "id" TEXT NOT NULL,
    "make" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "yearOfManufacture" INTEGER NOT NULL,
    "bodyShape" TEXT NOT NULL,
    "fuelType" TEXT,
    "cylinders" INTEGER,
    "factoryGvmKg" INTEGER,
    "kerbTareKg" INTEGER,
    "registrationCount" INTEGER NOT NULL DEFAULT 0,
    "gvmDistinctCount" INTEGER NOT NULL DEFAULT 0,
    "gvmMinKg" INTEGER,
    "gvmMaxKg" INTEGER,
    "gvmUpgradeSignal" BOOLEAN NOT NULL DEFAULT false,
    "gvmDistribution" JSONB,
    "source" TEXT NOT NULL DEFAULT 'QLD_LIGHT_VEHICLE_FLEET',
    "ingestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QldFleetVehicle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QldFleetVehicle_make_model_idx" ON "QldFleetVehicle"("make", "model");

-- CreateIndex
CREATE INDEX "QldFleetVehicle_registrationCount_idx" ON "QldFleetVehicle"("registrationCount");

-- CreateIndex
CREATE INDEX "QldFleetVehicle_gvmUpgradeSignal_idx" ON "QldFleetVehicle"("gvmUpgradeSignal");

-- CreateIndex
CREATE UNIQUE INDEX "QldFleetVehicle_make_model_yearOfManufacture_bodyShape_key" ON "QldFleetVehicle"("make", "model", "yearOfManufacture", "bodyShape");
