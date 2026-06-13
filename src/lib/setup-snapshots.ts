import { prisma } from '@/lib/db';
import type { Prisma } from '@prisma/client';

export interface VehicleSnapshot {
  id: string;
  name: string;
  modelName: string;
  makeName: string;
  yearFrom: number;
  yearTo: number;
  // Community-submitted variants may have null specs until moderation fills them in
  gvmKg: number | null;
  gcmKg: number | null;
  kerbWeightKg: number | null;
  maxTowingCapacityKg: number | null;
  frontAxleLimitKg: number | null;
  rearAxleLimitKg: number | null;
  wheelbaseMm: number | null;
  frontOverhangMm: number | null;
  rearOverhangMm: number | null;
  totalLengthMm: number | null;
  maxTowBallDownloadKg: number | null;
  fuelTankCapacityL: number | null;
  fuelType: string | null;
  market: string;
  snapshotVersion: 1;
}

export interface CaravanSnapshot {
  id: string;
  name: string;
  modelName: string;
  makeName: string;
  yearFrom: number;
  yearTo: number;
  atmKg: number | null;
  gtmKg: number | null;
  tareKg: number | null;
  tbmKg: number | null;
  axleConfiguration: string;
  couplingToAxleMm: number | null;
  axleSpacingMm: number | null;
  bodyLengthMm: number | null;
  overallLengthMm: number | null;
  freshWaterCapacityL: number | null;
  greyWaterCapacityL: number | null;
  gasBottleConfig: string | null;
  market: string;
  snapshotVersion: 1;
}

export interface AccessoryFitmentSnapshot {
  fitmentId: string;
  accessoryId: string;
  accessoryName: string;
  brandName: string;
  categoryName: string;
  installedWeightKg: number;
  mountingLocation: string;
  positionType: string;
  tankCapacityL: number | null;
  tankContentsKgPerL: number | null;
  snapshotVersion: 1;
}

export async function buildVehicleSnapshot(
  variantId: string,
): Promise<VehicleSnapshot | null> {
  const v = await prisma.vehicleVariant.findUnique({
    where: { id: variantId },
    include: { model: { include: { make: true } } },
  });
  if (!v) return null;
  return {
    id: v.id,
    name: v.name,
    modelName: v.model.name,
    makeName: v.model.make.name,
    yearFrom: v.yearFrom,
    yearTo: v.yearTo,
    gvmKg: v.gvmKg,
    gcmKg: v.gcmKg,
    kerbWeightKg: v.kerbWeightKg,
    maxTowingCapacityKg: v.maxTowingCapacityKg,
    frontAxleLimitKg: v.frontAxleLimitKg,
    rearAxleLimitKg: v.rearAxleLimitKg,
    wheelbaseMm: v.wheelbaseMm,
    frontOverhangMm: v.frontOverhangMm,
    rearOverhangMm: v.rearOverhangMm,
    totalLengthMm: v.totalLengthMm,
    maxTowBallDownloadKg: v.maxTowBallDownloadKg,
    fuelTankCapacityL: v.fuelTankCapacityL,
    fuelType: v.fuelType,
    market: v.market,
    snapshotVersion: 1,
  };
}

export async function buildCaravanSnapshot(
  variantId: string,
): Promise<CaravanSnapshot | null> {
  const c = await prisma.caravanVariant.findUnique({
    where: { id: variantId },
    include: { model: { include: { make: true } } },
  });
  if (!c) return null;
  return {
    id: c.id,
    name: c.name,
    modelName: c.model.name,
    makeName: c.model.make.name,
    yearFrom: c.yearFrom,
    yearTo: c.yearTo,
    atmKg: c.atmKg,
    gtmKg: c.gtmKg,
    tareKg: c.tareKg,
    tbmKg: c.tbmKg,
    axleConfiguration: c.axleConfiguration,
    couplingToAxleMm: c.couplingToAxleMm,
    axleSpacingMm: c.axleSpacingMm,
    bodyLengthMm: c.bodyLengthMm,
    overallLengthMm: c.overallLengthMm,
    freshWaterCapacityL: c.freshWaterCapacityL,
    greyWaterCapacityL: c.greyWaterCapacityL,
    gasBottleConfig: c.gasBottleConfig,
    market: c.market,
    snapshotVersion: 1,
  };
}

export async function buildAccessorySnapshots(
  fitmentIds: string[],
): Promise<AccessoryFitmentSnapshot[]> {
  if (fitmentIds.length === 0) return [];
  const fitments = await prisma.accessoryFitment.findMany({
    where: { id: { in: fitmentIds } },
    include: {
      accessory: { include: { brand: true, category: true } },
    },
  });
  return fitments.map((f) => ({
    fitmentId: f.id,
    accessoryId: f.accessoryId,
    accessoryName: f.accessory.name,
    brandName: f.accessory.brand.name,
    categoryName: f.accessory.category.name,
    installedWeightKg: Number(f.installedWeightKg),
    mountingLocation: f.mountingLocation,
    positionType: f.positionType,
    tankCapacityL: f.tankCapacityL ? Number(f.tankCapacityL) : null,
    tankContentsKgPerL: f.tankContentsKgPerL
      ? Number(f.tankContentsKgPerL)
      : null,
    snapshotVersion: 1,
  }));
}

export async function buildSnapshots(data: {
  vehicleVariantId?: string | null;
  caravanVariantId?: string | null;
  accessoryFitmentIds: string[];
  caravanAccessoryFitmentIds: string[];
}): Promise<{
  vehicleSnapshot: Prisma.InputJsonValue | undefined;
  caravanSnapshot: Prisma.InputJsonValue | undefined;
  accessorySnapshot: Prisma.InputJsonValue | undefined;
}> {
  const [vehicleSnap, caravanSnap, accSnaps, caravanAccSnaps] =
    await Promise.all([
      data.vehicleVariantId
        ? buildVehicleSnapshot(data.vehicleVariantId)
        : null,
      data.caravanVariantId
        ? buildCaravanSnapshot(data.caravanVariantId)
        : null,
      buildAccessorySnapshots(data.accessoryFitmentIds),
      buildAccessorySnapshots(data.caravanAccessoryFitmentIds),
    ]);

  return {
    vehicleSnapshot: vehicleSnap
      ? (vehicleSnap as unknown as Prisma.InputJsonValue)
      : undefined,
    caravanSnapshot: caravanSnap
      ? (caravanSnap as unknown as Prisma.InputJsonValue)
      : undefined,
    accessorySnapshot:
      accSnaps.length > 0 || caravanAccSnaps.length > 0
        ? ([
            ...accSnaps.map((s) => ({ ...s, target: 'vehicle' })),
            ...caravanAccSnaps.map((s) => ({ ...s, target: 'caravan' })),
          ] as unknown as Prisma.InputJsonValue)
        : undefined,
  };
}
