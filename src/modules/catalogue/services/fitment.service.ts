import type { PrismaClient, MountingLocation } from '@prisma/client';
import type {
  AccessoryFitmentDto,
  CreateAccessoryFitmentInput,
  UpdateAccessoryFitmentInput,
  ResolvedPositionChain,
  MountingCompatibilityResult,
} from '../types/fitment.types';

// Mounting locations available on a bare vehicle (no accessories required).
const VEHICLE_BASE_LOCATIONS = new Set<MountingLocation>([
  'CHASSIS_FRONT',
  'CHASSIS_MID',
  'CHASSIS_REAR',
  'BONNET',
  'ROOF_RACK',
  'ROOF_RAILS',
  'TUB_INTERIOR',
  'TUB_EXTERIOR',
  'CABIN_INTERIOR',
  'CABIN_ROOF',
  'CABIN_DASH',
  'DOOR_LEFT',
  'DOOR_RIGHT',
  'WHEEL_ARCH_LEFT',
  'WHEEL_ARCH_RIGHT',
  'UNDERBODY_FRONT',
  'UNDERBODY_MID',
  'UNDERBODY_REAR',
  'A_PILLAR_LEFT',
  'A_PILLAR_RIGHT',
  'WINDSCREEN',
  'FENDER_LEFT',
  'FENDER_RIGHT',
  'REAR_BAR',
  'TOW_HITCH',
]);

const CARAVAN_BASE_LOCATIONS = new Set<MountingLocation>([
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

function toDto(raw: {
  installedWeightKg: { toNumber(): number };
  tankCapacityL: { toNumber(): number } | null;
  tankContentsKgPerL: { toNumber(): number } | null;
  [key: string]: unknown;
}): AccessoryFitmentDto {
  return {
    ...(raw as unknown as AccessoryFitmentDto),
    installedWeightKg: raw.installedWeightKg.toNumber(),
    tankCapacityL: raw.tankCapacityL ? raw.tankCapacityL.toNumber() : null,
    tankContentsKgPerL: raw.tankContentsKgPerL
      ? raw.tankContentsKgPerL.toNumber()
      : null,
  };
}

export function createFitmentService(prisma: PrismaClient) {
  async function create(
    input: CreateAccessoryFitmentInput,
  ): Promise<AccessoryFitmentDto> {
    const raw = await prisma.accessoryFitment.create({ data: input as never });
    return toDto(raw as never);
  }

  async function update(
    id: string,
    input: UpdateAccessoryFitmentInput,
  ): Promise<AccessoryFitmentDto> {
    const raw = await prisma.accessoryFitment.update({
      where: { id },
      data: input as never,
    });
    return toDto(raw as never);
  }

  async function remove(id: string): Promise<void> {
    await prisma.accessoryFitment.delete({ where: { id } });
  }

  async function getById(id: string): Promise<AccessoryFitmentDto | null> {
    const raw = await prisma.accessoryFitment.findUnique({ where: { id } });
    return raw ? toDto(raw as never) : null;
  }

  async function getFitmentsForVehicleVariant(
    vehicleVariantId: string,
  ): Promise<AccessoryFitmentDto[]> {
    const rows = await prisma.accessoryFitment.findMany({
      where: { vehicleVariantId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => toDto(r as never));
  }

  async function getFitmentsForCaravanVariant(
    caravanVariantId: string,
  ): Promise<AccessoryFitmentDto[]> {
    const rows = await prisma.accessoryFitment.findMany({
      where: { caravanVariantId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => toDto(r as never));
  }

  async function getFitmentsForAccessory(
    accessoryId: string,
  ): Promise<AccessoryFitmentDto[]> {
    const rows = await prisma.accessoryFitment.findMany({
      where: { accessoryId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => toDto(r as never));
  }

  // Returns the set of available mounting locations for a vehicle variant,
  // factoring in which fitments are already installed.
  async function getAvailableMountingLocations(
    vehicleVariantId: string,
    fittedFitmentIds: string[],
  ): Promise<MountingLocation[]> {
    const available = new Set<MountingLocation>(VEHICLE_BASE_LOCATIONS);

    if (fittedFitmentIds.length === 0) return Array.from(available);

    const fitments = await prisma.accessoryFitment.findMany({
      where: { id: { in: fittedFitmentIds }, vehicleVariantId },
      select: { mountingLocation: true, providesMountingLocations: true },
    });

    for (const f of fitments) {
      // Unlock new locations provided by this fitment
      for (const loc of f.providesMountingLocations) {
        available.add(loc);
      }
      // Mark the fitment's own mounting location as occupied
      available.delete(f.mountingLocation);
    }

    return Array.from(available);
  }

  // Resolves the absolute CoG X position for a fitment, optionally relative
  // to a parent fitment that it mounts onto.
  async function resolvePositionChain(
    fitmentId: string,
    parentFitmentId?: string | null,
  ): Promise<ResolvedPositionChain> {
    const fitment = await prisma.accessoryFitment.findUniqueOrThrow({
      where: { id: fitmentId },
      select: { cogXMm: true, mountOffsetXMm: true },
    });

    if (!parentFitmentId) {
      const fitmentCogX = fitment.cogXMm ?? 0;
      const mountOffset = fitment.mountOffsetXMm ?? 0;
      return {
        absoluteCogXMm: mountOffset + fitmentCogX,
        parentCogXMm: null,
        fitmentMountOffsetXMm: fitment.mountOffsetXMm,
        fitmentCogXMm: fitment.cogXMm,
      };
    }

    const parent = await prisma.accessoryFitment.findUniqueOrThrow({
      where: { id: parentFitmentId },
      select: { cogXMm: true },
    });

    const parentCogX = parent.cogXMm ?? 0;
    const mountOffset = fitment.mountOffsetXMm ?? 0;
    const fitmentCogX = fitment.cogXMm ?? 0;

    return {
      absoluteCogXMm: parentCogX + mountOffset + fitmentCogX,
      parentCogXMm: parent.cogXMm,
      fitmentMountOffsetXMm: fitment.mountOffsetXMm,
      fitmentCogXMm: fitment.cogXMm,
    };
  }

  // Validates that parentFitment provides the mounting location required
  // by fitment. Returns a structured result rather than throwing.
  async function validateMountingCompatibility(
    fitmentId: string,
    parentFitmentId: string,
  ): Promise<MountingCompatibilityResult> {
    const [fitment, parent] = await Promise.all([
      prisma.accessoryFitment.findUniqueOrThrow({
        where: { id: fitmentId },
        select: { mountingLocation: true },
      }),
      prisma.accessoryFitment.findUniqueOrThrow({
        where: { id: parentFitmentId },
        select: { providesMountingLocations: true },
      }),
    ]);

    return {
      compatible: parent.providesMountingLocations.includes(
        fitment.mountingLocation,
      ),
      requiredLocation: fitment.mountingLocation,
      parentProvides: parent.providesMountingLocations,
    };
  }

  return {
    create,
    update,
    remove,
    getById,
    getFitmentsForVehicleVariant,
    getFitmentsForCaravanVariant,
    getFitmentsForAccessory,
    getAvailableMountingLocations,
    resolvePositionChain,
    validateMountingCompatibility,
  };
}

export type FitmentService = ReturnType<typeof createFitmentService>;
export { VEHICLE_BASE_LOCATIONS, CARAVAN_BASE_LOCATIONS };
