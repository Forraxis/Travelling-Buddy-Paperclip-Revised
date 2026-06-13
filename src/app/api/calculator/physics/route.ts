import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withRateLimit, serverError } from '@/lib/api-helpers';
import { z } from 'zod';
import { calculate } from '@/lib/physics/engine';
import type { AccessoryLoad, MountingLocation } from '@/lib/physics/types';

const accessorySchema = z.object({
  accessoryId: z.string(),
  massKg: z.number().min(0),
  mountingLocation: z.string(),
});

const schema = z.object({
  vehicleVariantId: z.string(),
  caravanVariantId: z.string().optional().nullable(),
  passengers: z.number().int().min(0).max(20),
  cargoKg: z.number().min(0),
  fuelPercent: z.number().min(0).max(100),
  freshWaterPercent: z.number().min(0).max(100),
  greyWaterPercent: z.number().min(0).max(100),
  accessories: z.array(accessorySchema),
});

const CARAVAN_LOCATIONS = new Set([
  'CARAVAN_DRAWBAR',
  'CARAVAN_A_FRAME',
  'CARAVAN_CHASSIS_FRONT',
  'CARAVAN_CHASSIS_MID',
  'CARAVAN_CHASSIS_REAR',
  'CARAVAN_UNDERBODY',
  'CARAVAN_ROOF',
  'CARAVAN_WALL_LEFT',
  'CARAVAN_WALL_RIGHT',
  'CARAVAN_WALL_FRONT',
  'CARAVAN_WALL_REAR',
  'CARAVAN_BUMPER_BAR',
  'CARAVAN_BOOT',
  'CARAVAN_TUNNEL_BOOT',
  'CARAVAN_TOOLBAR_EXTERNAL',
  'CARAVAN_TOOLBAR_INTERNAL',
]);

function toAccessoryLoad(a: {
  massKg: number;
  mountingLocation: string;
}): AccessoryLoad {
  return {
    installedWeightKg: a.massKg,
    mountingLocation: a.mountingLocation as MountingLocation,
    fillPercent: 100,
    quantity: 1,
  };
}

export async function POST(request: Request) {
  const limited = withRateLimit(request);
  if (limited) return limited;

  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    const {
      vehicleVariantId,
      caravanVariantId,
      passengers,
      cargoKg,
      fuelPercent,
      freshWaterPercent,
      greyWaterPercent,
      accessories,
    } = parsed.data;

    const vehicle = await prisma.vehicleVariant.findUnique({
      where: { id: vehicleVariantId },
    });
    if (!vehicle) {
      return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 });
    }

    let caravan = null;
    if (caravanVariantId) {
      caravan = await prisma.caravanVariant.findUnique({
        where: { id: caravanVariantId },
      });
    }

    const vehicleAccessories: AccessoryLoad[] = accessories
      .filter((a) => !CARAVAN_LOCATIONS.has(a.mountingLocation))
      .map(toAccessoryLoad);

    const caravanAccessories: AccessoryLoad[] = accessories
      .filter((a) => CARAVAN_LOCATIONS.has(a.mountingLocation))
      .map(toAccessoryLoad);

    const result = calculate({
      vehicle: {
        gvmKg: vehicle.gvmKg ?? 0,
        gcmKg: vehicle.gcmKg ?? 0,
        kerbWeightKg: vehicle.kerbWeightKg ?? 0,
        maxTowingCapacityKg: vehicle.maxTowingCapacityKg ?? 0,
        frontAxleLimitKg: vehicle.frontAxleLimitKg ?? 0,
        rearAxleLimitKg: vehicle.rearAxleLimitKg ?? 0,
        maxTowBallDownloadKg: vehicle.maxTowBallDownloadKg ?? 0,
        wheelbaseMm: vehicle.wheelbaseMm ?? 0,
        frontOverhangMm: vehicle.frontOverhangMm,
        rearOverhangMm: vehicle.rearOverhangMm,
        fuelTankCapacityL: vehicle.fuelTankCapacityL ?? 0,
        fuelType: (vehicle.fuelType ?? 'PETROL') as
          | 'DIESEL'
          | 'PETROL'
          | 'HYBRID'
          | 'ELECTRIC',
      },
      caravan: caravan
        ? {
            atmKg: caravan.atmKg ?? 0,
            gtmKg: caravan.gtmKg ?? 0,
            tareKg: caravan.tareKg ?? 0,
            tbmKg: caravan.tbmKg ?? 0,
            axleConfiguration: caravan.axleConfiguration as
              | 'SINGLE_AXLE'
              | 'DUAL_AXLE_CLOSE_COUPLED'
              | 'DUAL_AXLE_SPREAD'
              | 'TRIPLE_AXLE',
            couplingToAxleMm: caravan.couplingToAxleMm ?? 0,
            axleSpacingMm: caravan.axleSpacingMm,
            freshWaterCapacityL: caravan.freshWaterCapacityL ?? 0,
            greyWaterCapacityL: caravan.greyWaterCapacityL ?? 0,
          }
        : undefined,
      vehicleAccessories,
      caravanAccessories,
      passengers,
      cargoKg,
      fuelPercent,
      freshWaterPercent,
      greyWaterPercent,
      regulationSetCode: 'AU_ADR',
    });

    return NextResponse.json(result);
  } catch (err) {
    return serverError(err);
  }
}
